<script lang="ts">
  import type { PluginEntry } from "../data/types";
  import type { TreeGroup, TreeModel } from "../data/tree";
  import { formatCount } from "../data/format";
  import Icon from "./Icon.svelte";

  let {
    model,
    selected,
    installedIds,
    onSelect,
  }: {
    model: TreeModel;
    selected: PluginEntry | null;
    installedIds: Set<string>;
    onSelect: (entry: PluginEntry) => void;
  } = $props();

  const FOLDER_PAGE = 150;

  let expanded = $state<Set<string>>(new Set());
  let folderLimits = $state<Record<string, number>>({});

  function toggleFolder(key: string): void {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expanded = next;
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

  let staleTotal = $derived(model.stale.reduce((n, g) => n + g.entries.length, 0));
</script>

{#snippet folder(group: TreeGroup, key: string, depth: number)}
  <div
    class="bs-tree-folder"
    style={`--bs-depth:${depth}`}
    role="button"
    tabindex="0"
    onclick={() => toggleFolder(key)}
    onkeydown={(e) => activate(e, () => toggleFolder(key))}
  >
    <Icon name={expanded.has(key) ? "chevron-down" : "chevron-right"} />
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

<div class="bs-tree">
  {#each model.groups as group (group.label)}
    {@render folder(group, group.label, 0)}
  {/each}

  {#if staleTotal > 0}
    <div
      class="bs-tree-folder bs-tree-stale"
      style="--bs-depth:0"
      role="button"
      tabindex="0"
      onclick={() => toggleFolder("__stale__")}
      onkeydown={(e) => activate(e, () => toggleFolder("__stale__"))}
    >
      <Icon name={expanded.has("__stale__") ? "chevron-down" : "chevron-right"} />
      <Icon name="archive" />
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
