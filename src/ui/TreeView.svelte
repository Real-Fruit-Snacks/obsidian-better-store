<script lang="ts">
  import type BetterStorePlugin from "../main";
  import type { PluginEntry } from "../data/types";
  import type { TreeGroup, TreeModel } from "../data/tree";
  import { formatCount } from "../data/format";
  import Icon from "./Icon.svelte";

  let {
    model,
    sort,
    plugin,
    selected,
    installedIds,
    onSelect,
  }: {
    model: TreeModel;
    sort: string;
    plugin: BetterStorePlugin;
    selected: PluginEntry | null;
    installedIds: Set<string>;
    onSelect: (entry: PluginEntry) => void;
  } = $props();

  const FOLDER_PAGE = 150;

  // Expanded folders persist per sort mode (in plugin data), so the tree
  // reopens where the user left it. The parent keys this component by sort.
  let expanded = $state<Set<string>>(new Set(plugin.settings.ui.treeExpanded[sort] ?? []));
  let folderLimits = $state<Record<string, number>>({});

  function persistExpanded(): void {
    plugin.settings.ui.treeExpanded = { ...plugin.settings.ui.treeExpanded, [sort]: [...expanded] };
    void plugin.saveSettings();
  }

  function toggleFolder(key: string): void {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expanded = next;
    persistExpanded();
  }

  function showMore(key: string): void {
    folderLimits = { ...folderLimits, [key]: (folderLimits[key] ?? FOLDER_PAGE) + 300 };
  }

  function activate(e: KeyboardEvent, action: () => void): void {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  }

  /** Arrow-key navigation: Up/Down move between rows, Right/Left expand/collapse folders. */
  function treeNav(node: HTMLElement) {
    const handler = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const rows = Array.from(node.querySelectorAll<HTMLElement>("[data-row]"));
      const idx = rows.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;
      e.preventDefault();
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        rows[idx + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
        return;
      }
      const key = rows[idx].dataset.key;
      if (!key) return;
      const open = expanded.has(key);
      if ((e.key === "ArrowRight" && !open) || (e.key === "ArrowLeft" && open)) toggleFolder(key);
    };
    node.addEventListener("keydown", handler);
    return { destroy: () => node.removeEventListener("keydown", handler) };
  }

  let staleTotal = $derived(model.stale.reduce((n, g) => n + g.entries.length, 0));
</script>

{#snippet folder(group: TreeGroup, key: string, depth: number)}
  <div
    class="bs-tree-folder"
    style={`--bs-depth:${depth}`}
    data-depth={depth}
    data-row
    data-key={key}
    role="button"
    tabindex="0"
    onclick={() => toggleFolder(key)}
    onkeydown={(e) => activate(e, () => toggleFolder(key))}
  >
    <Icon name={expanded.has(key) ? "folder-open" : "folder"} />
    <span class="bs-tree-label">{group.label}</span>
    <span class="bs-tree-count">{group.entries.length.toLocaleString()}</span>
  </div>
  {#if expanded.has(key)}
    {#each group.entries.slice(0, folderLimits[key] ?? FOLDER_PAGE) as entry (entry.id)}
      <div
        class="bs-tree-item"
        class:bs-tree-item-selected={selected?.id === entry.id}
        style={`--bs-depth:${depth + 1}`}
        data-depth={depth + 1}
        data-row
        role="button"
        tabindex="0"
        onclick={() => onSelect(entry)}
        onkeydown={(e) => activate(e, () => onSelect(entry))}
      >
        <Icon name="puzzle" />
        <span class="bs-tree-name">{entry.name}</span>
        {#if installedIds.has(entry.id)}<span class="bs-badge bs-badge-installed">Installed</span>{/if}
        <span class="bs-tree-meta"><Icon name="download" />{formatCount(entry.downloads)}</span>
      </div>
    {/each}
    {#if group.entries.length > (folderLimits[key] ?? FOLDER_PAGE)}
      <div
        class="bs-tree-more"
        style={`--bs-depth:${depth + 1}`}
        data-depth={depth + 1}
        data-row
        role="button"
        tabindex="0"
        onclick={() => showMore(key)}
        onkeydown={(e) => activate(e, () => showMore(key))}
      >
        Show more ({(group.entries.length - (folderLimits[key] ?? FOLDER_PAGE)).toLocaleString()} remaining)
      </div>
    {/if}
  {/if}
{/snippet}

<div class="bs-tree" use:treeNav>
  {#each model.groups as group (group.label)}
    {@render folder(group, group.label, 0)}
  {/each}

  {#if staleTotal > 0}
    <div
      class="bs-tree-folder bs-tree-stale"
      style="--bs-depth:0"
      data-row
      data-key="__stale__"
      role="button"
      tabindex="0"
      onclick={() => toggleFolder("__stale__")}
      onkeydown={(e) => activate(e, () => toggleFolder("__stale__"))}
    >
      <Icon name={expanded.has("__stale__") ? "folder-open" : "folder"} />
      <span class="bs-tree-label">Stale (12+ months)</span>
      <span class="bs-tree-count">{staleTotal.toLocaleString()}</span>
    </div>
    {#if expanded.has("__stale__")}
      {#each model.stale as group (group.label)}
        {@render folder(group, `stale:${group.label}`, 1)}
      {/each}
    {/if}
  {/if}
</div>
