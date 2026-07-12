<script lang="ts">
  import { onMount } from "svelte";
  import type BetterStorePlugin from "../main";
  import type { PluginEntry } from "../data/types";
  import { buildInstalledInfo, type InstalledInfo } from "../data/installed";
  import { formatAge } from "../data/format";
  import { getPluginsApi } from "./store-context";
  import Icon from "./Icon.svelte";

  let {
    plugin,
    entries,
    onSelect,
  }: {
    plugin: BetterStorePlugin;
    entries: PluginEntry[];
    onSelect: (entry: PluginEntry) => void;
  } = $props();

  let infos = $state<InstalledInfo[]>([]);
  let checking = $state(true);
  let toggleError = $state<string | null>(null);
  let query = $state("");
  let updatesOnly = $state(false);

  const api = getPluginsApi(plugin.app);
  const byId = $derived(new Map(entries.map((e) => [e.id, e])));

  let updateCount = $derived(infos.filter((i) => i.updateAvailable).length);

  let visible = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const filtered = infos.filter(
      (i) =>
        (!updatesOnly || i.updateAvailable) &&
        (q === "" || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    );
    // Updates float to the top; everything else stays alphabetical.
    return filtered.sort(
      (a, b) => Number(b.updateAvailable) - Number(a.updateAvailable) || a.name.localeCompare(b.name)
    );
  });

  function rebuild(latestVersions: Record<string, string | null>): void {
    infos = buildInstalledInfo(api.manifests, new Set(api.enabledPlugins), entries, latestVersions, Date.now());
  }

  onMount(async () => {
    rebuild({});
    const latest: Record<string, string | null> = {};
    await Promise.all(
      infos
        .filter((i) => i.repo != null && i.id !== plugin.manifest.id)
        .map(async (i) => {
          latest[i.id] = await plugin.service.getLatestVersion(i.repo as string);
        })
    );
    rebuild(latest);
    checking = false;
  });

  async function toggle(info: InstalledInfo): Promise<void> {
    if (info.id === plugin.manifest.id) return;
    toggleError = null;
    try {
      if (info.enabled) await api.disablePluginAndSave(info.id);
      else await api.enablePluginAndSave(info.id);
    } catch (e) {
      toggleError = `Could not toggle ${info.name}: ${e instanceof Error ? e.message : String(e)}`;
    }
    infos = infos.map((i) => (i.id === info.id ? { ...i, enabled: api.enabledPlugins.has(i.id) } : i));
  }

  function openNative(id: string): void {
    window.open(`obsidian://show-plugin?id=${encodeURIComponent(id)}`);
  }
</script>

<div class="bs-installed">
  <div class="bs-installed-toolbar">
    <input
      type="search"
      class="bs-installed-search"
      placeholder="Filter installed plugins…"
      aria-label="Filter installed plugins"
      bind:value={query}
    />
    <button
      class="bs-chip"
      class:bs-chip-active={updatesOnly}
      onclick={() => (updatesOnly = !updatesOnly)}
    >
      Updates{#if !checking}&nbsp;({updateCount}){/if}
    </button>
    <span class="bs-installed-summary">
      {#if checking}
        Checking for updates…
      {:else}
        {infos.length} installed · {updateCount} {updateCount === 1 ? "update" : "updates"} available
      {/if}
    </span>
  </div>

  {#if toggleError}
    <div class="bs-status bs-error">{toggleError}</div>
  {/if}

  <div class="bs-installed-list">
    {#each visible as info (info.id)}
      {@const entry = byId.get(info.id)}
      <div class="bs-installed-row" class:bs-installed-off={!info.enabled}>
        <div class="bs-installed-main">
          <div class="bs-installed-title">
            {#if entry}
              <button class="bs-link" onclick={() => onSelect(entry)}>{info.name}</button>
            {:else}
              <span class="bs-installed-name">{info.name}</span>
            {/if}
            {#if info.abandoned}
              <span class="bs-badge bs-badge-warn" title="No update in over a year">stale</span>
            {/if}
          </div>
          <div class="bs-installed-sub">
            <span>v{info.version}</span>
            <span>·</span>
            <span>{info.updated ? `updated ${formatAge(info.updated, Date.now())}` : "not in catalog"}</span>
            {#if entry}
              <span>·</span>
              <span class="bs-installed-desc">{entry.description}</span>
            {/if}
          </div>
        </div>

        {#if info.updateAvailable}
          <button
            class="bs-update-btn"
            title="Open in Community Plugins to update"
            onclick={() => openNative(info.id)}
          >
            <Icon name="arrow-up" />Update to {info.latestVersion}
          </button>
        {/if}

        {#if info.repo}
          <a
            class="bs-installed-changelog"
            href={`https://github.com/${info.repo}/releases`}
            target="_blank"
            rel="noopener"
            title="Changelog"
            aria-label={`Changelog for ${info.name}`}
          >
            <Icon name="scroll-text" />
          </a>
        {/if}

        <div
          class="checkbox-container bs-installed-toggle"
          class:is-enabled={info.enabled}
          class:bs-toggle-locked={info.id === plugin.manifest.id}
          role="switch"
          aria-checked={info.enabled}
          aria-label={`Enable ${info.name}`}
          tabindex={info.id === plugin.manifest.id ? -1 : 0}
          title={info.id === plugin.manifest.id ? "Better Store cannot disable itself" : info.enabled ? "Disable" : "Enable"}
          onclick={() => void toggle(info)}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void toggle(info);
            }
          }}
        >
          <input type="checkbox" tabindex="-1" checked={info.enabled} disabled={info.id === plugin.manifest.id} />
        </div>
      </div>
    {:else}
      <div class="bs-status">
        {updatesOnly ? "Everything is up to date." : "No installed plugins match."}
      </div>
    {/each}
  </div>
</div>
