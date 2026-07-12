<script lang="ts">
  import { onMount } from "svelte";
  import type BetterStorePlugin from "../main";
  import type { PluginEntry } from "../data/types";
  import { buildInstalledInfo, type InstalledInfo } from "../data/installed";
  import { formatAge } from "../data/format";
  import { getPluginsApi } from "./store-context";

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

  const api = getPluginsApi(plugin.app);
  const byId = $derived(new Map(entries.map((e) => [e.id, e])));

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
  {#if checking}
    <div class="bs-count">Checking for updates…</div>
  {:else}
    <div class="bs-count">
      {infos.length} installed · {infos.filter((i) => i.updateAvailable).length} updates available
    </div>
  {/if}
  {#if toggleError}
    <div class="bs-status bs-error">{toggleError}</div>
  {/if}

  <table class="bs-installed-table">
    <thead>
      <tr><th>Plugin</th><th>Version</th><th>Updated</th><th>Enabled</th><th></th></tr>
    </thead>
    <tbody>
      {#each infos as info (info.id)}
        <tr>
          <td>
            {#if byId.get(info.id)}
              <button class="bs-link" onclick={() => onSelect(byId.get(info.id) as PluginEntry)}>{info.name}</button>
            {:else}
              {info.name}
            {/if}
            {#if info.abandoned}<span class="bs-badge bs-badge-warn" title="No update in over a year">stale</span>{/if}
          </td>
          <td>
            {info.version}
            {#if info.updateAvailable}
              <button class="bs-badge bs-badge-update" title="Open in Community Plugins to update" onclick={() => openNative(info.id)}>
                → {info.latestVersion}
              </button>
            {/if}
          </td>
          <td>{info.updated != null ? formatAge(info.updated, Date.now()) : "—"}</td>
          <td>
            <input
              type="checkbox"
              checked={info.enabled}
              disabled={info.id === plugin.manifest.id}
              onchange={() => void toggle(info)}
            />
          </td>
          <td>
            {#if info.repo}
              <a href={`https://github.com/${info.repo}/releases`} target="_blank" rel="noopener" title="Changelog">changelog</a>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
