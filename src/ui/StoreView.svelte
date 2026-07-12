<script lang="ts">
  import { onMount } from "svelte";
  import type BetterStorePlugin from "../main";
  import type { BetterStoreView } from "../view";
  import type { PluginEntry } from "../data/types";
  import { EMPTY_FILTER, filterPlugins, type FilterState } from "../data/filter";
  import { getInstalledIds, type TabId } from "./store-context";
  import FilterSidebar from "./FilterSidebar.svelte";
  import PluginCard from "./PluginCard.svelte";
  import DetailPane from "./DetailPane.svelte";
  import InstalledTab from "./InstalledTab.svelte";
  import Icon from "./Icon.svelte";

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

  // Incremental rendering: keeping thousands of cards in the DOM makes tab
  // switches and filter changes take seconds (keyed reorder of every node).
  // Only a page is mounted; a sentinel below the grid grows it on scroll.
  const PAGE_SIZE = 60;
  let renderLimit = $state(PAGE_SIZE);
  let shown = $derived(visible.slice(0, renderLimit));

  function loadMoreSentinel(node: HTMLElement) {
    const observer = new IntersectionObserver(
      (intersections) => {
        if (intersections.some((i) => i.isIntersecting) && renderLimit < visible.length) {
          renderLimit += PAGE_SIZE;
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

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

  async function ignorePlugin(id: string): Promise<void> {
    if (!plugin.settings.ignoredPlugins.includes(id)) {
      plugin.settings.ignoredPlugins = [...plugin.settings.ignoredPlugins, id];
      await plugin.saveSettings();
    }
    if (selected?.id === id) selected = null;
  }

  let lastHideInstalledDefault = plugin.settings.hideInstalledByDefault;

  onMount(() => {
    void load();
    return plugin.registerSettingsListener(() => {
      if (plugin.settings.hideInstalledByDefault !== lastHideInstalledDefault) {
        lastHideInstalledDefault = plugin.settings.hideInstalledByDefault;
        filters = { ...filters, hideInstalled: plugin.settings.hideInstalledByDefault };
      }
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
          aria-pressed={tab === t.id}
          onclick={() => { tab = t.id; selected = null; renderLimit = PAGE_SIZE; }}
        >{t.label}</button>
      {/each}
    </nav>
    <button class="bs-refresh" title="Refresh catalog" onclick={() => void load(true)} disabled={loading}>
      <Icon name="refresh-cw" />Refresh
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
    <div class="bs-body">
      <main class="bs-main">
        <InstalledTab {plugin} {entries} onSelect={(entry) => { tab = "all"; selected = entry; }} />
      </main>
    </div>
  {:else}
    <div class="bs-body">
      <FilterSidebar {filters} showSort={tab === "all"} onChange={(next) => { filters = next; renderLimit = PAGE_SIZE; }} />
      <main class="bs-main">
        <div class="bs-count">{visible.length} plugins</div>
        <div class="bs-grid">
          {#each shown as entry (entry.id)}
            <PluginCard
              {entry}
              installed={installedIds.has(entry.id)}
              selected={selected?.id === entry.id}
              onSelect={() => (selected = entry)}
              onIgnore={() => void ignorePlugin(entry.id)}
            />
          {/each}
        </div>
        {#if renderLimit < visible.length}
          <div class="bs-load-more" use:loadMoreSentinel>
            Showing {renderLimit} of {visible.length} — scroll for more
          </div>
        {/if}
      </main>
      {#if selected}
        <DetailPane {plugin} {view} entry={selected} onClose={() => (selected = null)} />
      {/if}
    </div>
  {/if}
</div>
