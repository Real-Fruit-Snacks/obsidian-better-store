<script lang="ts">
  import { onMount } from "svelte";
  import type BetterStorePlugin from "../main";
  import type { BetterStoreView } from "../view";
  import type { PluginEntry } from "../data/types";
  import { EMPTY_FILTER, filterPlugins, type FilterState } from "../data/filter";
  import { getInstalledIds, type TabId } from "./store-context";

  let { plugin, view }: { plugin: BetterStorePlugin; view: BetterStoreView } = $props();

  let entries = $state<PluginEntry[]>([]);
  let loading = $state(true);
  let stale = $state(false);
  let error = $state<string | null>(null);
  let tab = $state<TabId>("all");
  let trendingDeltas = $state<Record<string, number>>({});
  let installedIds = $state<Set<string>>(new Set());
  let selected = $state<PluginEntry | null>(null);

  let filters = $state<FilterState>({
    ...EMPTY_FILTER,
    sort: plugin.settings.defaultSort,
    hideInstalled: plugin.settings.hideInstalledByDefault,
  });

  const TABS: { id: TabId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "updated", label: "Recently updated" },
    { id: "trending", label: "Trending" },
    { id: "installed", label: "Installed" },
  ];

  let effectiveFilters = $derived<FilterState>(
    tab === "updated" ? { ...filters, sort: "updated" }
    : tab === "trending" ? { ...filters, sort: "trending" }
    : filters
  );

  let visible = $derived(
    filterPlugins(entries, effectiveFilters, {
      installedIds,
      ignoredIds: new Set(plugin.settings.ignoredPlugins),
      trendingDeltas,
      now: Date.now(),
    })
  );

  async function load(force = false): Promise<void> {
    loading = true;
    error = null;
    try {
      const catalog = await plugin.service.loadCatalog(force);
      entries = catalog.entries;
      stale = catalog.stale;
      trendingDeltas = await plugin.service.getTrendingDeltas();
      installedIds = getInstalledIds(plugin.app);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
    plugin.registerSettingsListener(() => {
      filters = { ...filters, hideInstalled: plugin.settings.hideInstalledByDefault };
      // Re-render for ignore-list changes; catalog itself is unaffected.
      entries = [...entries];
    });
  });
</script>

<div class="bs-root">
  <header class="bs-header">
    <nav class="bs-tabs">
      {#each TABS as t (t.id)}
        <button
          class="bs-tab"
          class:bs-tab-active={tab === t.id}
          onclick={() => { tab = t.id; selected = null; }}
        >{t.label}</button>
      {/each}
    </nav>
    <button class="bs-refresh" title="Refresh catalog" onclick={() => void load(true)} disabled={loading}>
      ↻ Refresh
    </button>
  </header>

  {#if stale}
    <div class="bs-banner">Showing cached data — the registry could not be refreshed.</div>
  {/if}

  {#if tab === "trending" && !loading && Object.keys(trendingDeltas).length === 0}
    <div class="bs-banner">
      Trending compares download counts across catalog refreshes, so it needs a few days of history. Check back after using Better Store for a while.
    </div>
  {/if}

  {#if loading}
    <div class="bs-status">Loading plugin catalog…</div>
  {:else if error}
    <div class="bs-status bs-error">Failed to load the plugin catalog: {error}</div>
  {:else if tab === "installed"}
    <!-- installed tab mounts here (Task 12) -->
    <div class="bs-status">Installed view coming in a later task.</div>
  {:else}
    <div class="bs-body">
      <!-- sidebar mounts here (Task 10) -->
      <main class="bs-main">
        <!-- grid mounts here (Task 10) -->
        <div class="bs-status">{visible.length} plugins match.</div>
      </main>
      <!-- detail pane mounts here (Task 11) -->
    </div>
  {/if}
</div>
