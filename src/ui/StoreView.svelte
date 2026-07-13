<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { Menu, Notice } from "obsidian";
  import type BetterStorePlugin from "../main";
  import type { BetterStoreView } from "../view";
  import type { PluginEntry } from "../data/types";
  import { EMPTY_FILTER, filterPlugins, type FilterState, type SortKey } from "../data/filter";
  import { getInstalledIds, type TabId } from "./store-context";
  import { NEW_WINDOW_DAYS } from "../settings";
  import { similarPlugins } from "../data/similar";
  import { NameModal } from "./modals";
  import FilterSidebar from "./FilterSidebar.svelte";
  import PluginCard from "./PluginCard.svelte";
  import DetailPane from "./DetailPane.svelte";
  import InstalledTab from "./InstalledTab.svelte";
  import TreeView from "./TreeView.svelte";
  import Icon from "./Icon.svelte";
  import { buildTree } from "../data/tree";

  let { plugin, view }: { plugin: BetterStorePlugin; view: BetterStoreView } = $props();

  let entries = $state<PluginEntry[]>([]);
  let loading = $state(true);
  let stale = $state(false);
  let error = $state<string | null>(null);
  let tab = $state<TabId>(plugin.settings.ui.lastTab ?? "all");
  let trendingDeltas = $state<Record<string, number>>({});
  let installedIds = $state<Set<string>>(new Set());
  let newIds = $state<Set<string>>(new Set());
  let selected = $state<PluginEntry | null>(null);
  /** Bumped whenever settings save so derived sets re-read plugin.settings. */
  let settingsTick = $state(0);
  /** Bumped when a GitHub token is linked so the detail pane re-fetches. */
  let tokenTick = $state(0);
  /** Scanned GitHub stats keyed by repo; powers stars/issues/added sorts and filters. */
  let repoStats = $state<Record<string, { stars: number; openIssues: number; createdAt: number }>>({});
  let scanState = $state(plugin.scanState);

  let filters = $state<FilterState>({
    ...EMPTY_FILTER,
    sort: plugin.settings.defaultSort,
    hideInstalled: plugin.settings.hideInstalledByDefault,
  });

  const TABS: { id: TabId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "trending", label: "Trending" },
    { id: "installed", label: "Installed" },
  ];

  let trendingReady = $derived(Object.keys(trendingDeltas).length > 0);

  // Reactive token presence (tokenTick bumps when a token is linked/unlinked).
  let hasToken = $derived.by(() => {
    void tokenTick;
    void settingsTick;
    return plugin.service.hasGithubToken();
  });

  let requestedSort = $derived<SortKey>(tab === "trending" ? "trending" : filters.sort);

  // Without snapshot history all trending deltas are zero, which would yield
  // an arbitrary order — fall back to downloads until history exists.
  let effectiveFilters = $derived<FilterState>({
    ...filters,
    sort: requestedSort === "trending" && !trendingReady ? "downloads" : requestedSort,
  });

  let favoriteIds = $derived.by(() => {
    void settingsTick;
    return new Set(plugin.settings.favoritePlugins);
  });

  let showNewBadges = $derived.by(() => {
    void settingsTick;
    return plugin.settings.showNewBadges;
  });

  let filterPresets = $derived.by(() => {
    void settingsTick;
    return plugin.settings.filterPresets;
  });

  let similar = $derived.by(() => {
    void settingsTick;
    return selected && plugin.settings.showSimilar ? similarPlugins(selected, entries, 5) : [];
  });

  // Recently-viewed capture feeds the quick-jump ranking.
  $effect(() => {
    const id = selected?.id;
    if (!id) return;
    untrack(() => {
      if (!plugin.settings.trackRecentlyViewed) return;
      const current = plugin.settings.ui.recentlyViewed;
      if (current[0] === id) return;
      plugin.settings.ui.recentlyViewed = [id, ...current.filter((r) => r !== id)].slice(0, 20);
      void plugin.saveSettings();
    });
  });

  let visible = $derived.by(() => {
    void settingsTick;
    return filterPlugins(entries, effectiveFilters, {
      installedIds,
      ignoredIds: new Set(plugin.settings.ignoredPlugins),
      ignoredAuthors: new Set(plugin.settings.ignoredAuthors),
      ignoredCategories: new Set(plugin.settings.ignoredCategories),
      favoriteIds,
      newIds,
      trendingDeltas,
      repoStats,
      now: Date.now(),
    });
  });

  // Incremental rendering: keeping thousands of cards in the DOM makes tab
  // switches and filter changes take seconds (keyed reorder of every node).
  // Only a page is mounted; a sentinel below the grid grows it on scroll.
  const PAGE_SIZE = 60;
  let renderLimit = $state(PAGE_SIZE);
  let shown = $derived(visible.slice(0, renderLimit));

  // With a token linked (5,000 req/h), fetch star counts for the cards on
  // screen — one request per repo, session-cached. Anonymous browsing stays
  // API-free so the 60/hour limit is saved for the detail pane.
  const cardStars = new SvelteMap<string, number>();
  const requestedStars = new Set<string>();
  let starsHalted = false;

  let starsEnabled = $derived.by(() => {
    void settingsTick;
    void tokenTick;
    return plugin.settings.showCardStars && plugin.service.hasGithubToken();
  });

  $effect(() => {
    const targets = starsEnabled && layout === "grid" && tab !== "installed" ? shown : [];
    untrack(() => void prefetchStars(targets));
  });

  async function prefetchStars(targets: PluginEntry[]): Promise<void> {
    if (starsHalted) return;
    const queue = targets.filter((e) => !requestedStars.has(e.id));
    for (const e of queue) requestedStars.add(e.id);
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        let entry: PluginEntry | undefined;
        while (!starsHalted && (entry = queue.shift())) {
          try {
            cardStars.set(entry.id, (await plugin.service.getRepoStats(entry.repo)).stars);
          } catch {
            starsHalted = true; // rate-limited or offline — stop for this session
          }
        }
      })
    );
  }

  let layout = $state<"grid" | "tree">(plugin.settings.ui.layout);
  /** Mobile/narrow only: whether the filter sidebar drawer is open. */
  let showFilters = $state(false);

  function toggleLayout(): void {
    layout = layout === "grid" ? "tree" : "grid";
    plugin.settings.ui.layout = layout;
    void plugin.saveSettings();
  }

  let tree = $derived(
    layout === "tree"
      ? buildTree(visible, effectiveFilters.sort, { now: Date.now(), trendingDeltas, repoStats })
      : null
  );

  function loadMoreSentinel(node: HTMLElement) {
    // Use the element's own window so observation works in popout windows.
    const win = node.ownerDocument.defaultView ?? window;
    const observer = new win.IntersectionObserver(
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

  /** Arrow-key roving focus across the card grid. */
  function gridNav(node: HTMLElement) {
    const handler = (e: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const cards = Array.from(node.querySelectorAll<HTMLElement>(".bs-card"));
      const idx = cards.indexOf(node.ownerDocument.activeElement as HTMLElement);
      if (idx === -1) return;
      e.preventDefault();
      let target: HTMLElement | undefined;
      if (e.key === "ArrowLeft") target = cards[idx - 1];
      else if (e.key === "ArrowRight") target = cards[idx + 1];
      else {
        const rect = cards[idx].getBoundingClientRect();
        const down = e.key === "ArrowDown";
        let bestScore = Infinity;
        for (const card of cards) {
          const r = card.getBoundingClientRect();
          if (down ? r.top <= rect.top + 1 : r.top >= rect.top - 1) continue;
          const score = Math.abs(r.top - rect.top) * 10_000 + Math.abs(r.left - rect.left);
          if (score < bestScore) {
            bestScore = score;
            target = card;
          }
        }
      }
      target?.focus();
    };
    node.addEventListener("keydown", handler);
    return { destroy: () => node.removeEventListener("keydown", handler) };
  }

  async function load(force = false): Promise<void> {
    loading = true;
    error = null;
    try {
      const catalog = await plugin.service.loadCatalog(force);
      entries = catalog.entries;
      stale = catalog.stale;
      trendingDeltas = await plugin.service.getTrendingDeltas();
      newIds = await plugin.service.getNewIds(NEW_WINDOW_DAYS);
      installedIds = getInstalledIds(plugin.app);
      repoStats = await plugin.service.getAllRepoStats();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
      if (plugin.pendingDetailId) showDetail(plugin.pendingDetailId);
    }
  }

  async function refreshRepoStats(): Promise<void> {
    repoStats = await plugin.service.getAllRepoStats();
  }

  function startScan(): void {
    void plugin.startCatalogScan();
  }

  /** Quick-jump / external requests to open a plugin's detail pane. */
  function showDetail(id: string): void {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    plugin.pendingDetailId = null;
    selected = entry;
  }

  function openIgnoreMenu(e: MouseEvent, entry: PluginEntry): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle(`Ignore "${entry.name}"`)
        .setIcon("x")
        .onClick(async () => {
          if (!plugin.settings.ignoredPlugins.includes(entry.id)) {
            plugin.settings.ignoredPlugins = [...plugin.settings.ignoredPlugins, entry.id];
            await plugin.saveSettings();
          }
          if (selected?.id === entry.id) selected = null;
        })
    );
    menu.addItem((item) =>
      item
        .setTitle(`Ignore author "${entry.author}"`)
        .setIcon("user-x")
        .onClick(async () => {
          if (!plugin.settings.ignoredAuthors.includes(entry.author)) {
            plugin.settings.ignoredAuthors = [...plugin.settings.ignoredAuthors, entry.author];
            await plugin.saveSettings();
          }
          if (selected?.author === entry.author) selected = null;
        })
    );
    for (const cat of entry.categories) {
      menu.addItem((item) =>
        item
          .setTitle(`Ignore category "${cat}"`)
          .setIcon("tag")
          .onClick(async () => {
            if (!plugin.settings.ignoredCategories.includes(cat)) {
              plugin.settings.ignoredCategories = [...plugin.settings.ignoredCategories, cat];
              await plugin.saveSettings();
            }
            if (selected?.categories.includes(cat)) selected = null;
          })
      );
    }
    menu.showAtMouseEvent(e);
  }

  function savePreset(): void {
    new NameModal(plugin.app, "Save filter preset", (name) => {
      const withoutSameName = plugin.settings.filterPresets.filter((p) => p.name !== name);
      plugin.settings.filterPresets = [...withoutSameName, { name, state: { ...filters } }];
      void plugin.saveSettings();
      new Notice(`Preset "${name}" saved.`);
    }).open();
  }

  function resetFilters(): void {
    filters = { ...EMPTY_FILTER, sort: plugin.settings.defaultSort };
    renderLimit = PAGE_SIZE;
  }

  function setTab(next: TabId): void {
    tab = next;
    selected = null;
    renderLimit = PAGE_SIZE;
    plugin.settings.ui.lastTab = next;
    void plugin.saveSettings();
  }

  /** Author drill-down: show everything by one author on the All tab. */
  function drillAuthor(author: string): void {
    filters = { ...EMPTY_FILTER, sort: filters.sort, author };
    renderLimit = PAGE_SIZE;
    setTab("all");
  }

  function clearAuthor(): void {
    filters = { ...filters, author: "" };
    renderLimit = PAGE_SIZE;
  }

  async function toggleFavorite(id: string): Promise<void> {
    plugin.settings.favoritePlugins = plugin.settings.favoritePlugins.includes(id)
      ? plugin.settings.favoritePlugins.filter((f) => f !== id)
      : [...plugin.settings.favoritePlugins, id];
    await plugin.saveSettings();
  }

  let lastHideInstalledDefault = plugin.settings.hideInstalledByDefault;

  onMount(() => {
    void load();
    // Obsidian fires no event when a plugin is installed via the native
    // dialog, so poll the manifests while the view is open (cheap: key read
    // over ~dozens of entries) to keep Installed badges and state fresh.
    const installedPoll = window.setInterval(() => {
      const fresh = getInstalledIds(plugin.app);
      if (fresh.size !== installedIds.size || [...fresh].some((id) => !installedIds.has(id))) {
        installedIds = fresh;
      }
    }, 2000);
    const unsubscribeSettings = plugin.registerSettingsListener(() => {
      if (plugin.settings.hideInstalledByDefault !== lastHideInstalledDefault) {
        lastHideInstalledDefault = plugin.settings.hideInstalledByDefault;
        filters = { ...filters, hideInstalled: plugin.settings.hideInstalledByDefault };
      }
      settingsTick += 1;
    });
    const unsubscribeDetail = plugin.registerDetailListener((id) => showDetail(id));
    const unsubscribeToken = plugin.registerTokenListener(() => {
      // A fresh token means a fresh service cache and a fresh quota.
      requestedStars.clear();
      starsHalted = false;
      tokenTick += 1;
    });
    const unsubscribeScan = plugin.registerScanListener(() => {
      scanState = { ...plugin.scanState };
      void refreshRepoStats();
    });
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selected) {
        selected = null;
        e.stopPropagation();
      }
    };
    view.contentEl.addEventListener("keydown", onEscape);
    return () => {
      window.clearInterval(installedPoll);
      unsubscribeSettings();
      unsubscribeDetail();
      unsubscribeToken();
      unsubscribeScan();
      view.contentEl.removeEventListener("keydown", onEscape);
    };
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
          onclick={() => setTab(t.id)}
        >{t.label}</button>
      {/each}
    </nav>
    <div class="bs-header-actions">
      {#if tab !== "installed"}
        <button
          class="bs-refresh bs-filters-toggle"
          class:bs-tab-active={showFilters}
          title="Show or hide filters"
          aria-pressed={showFilters}
          onclick={() => (showFilters = !showFilters)}
        >
          <Icon name="sliders-horizontal" />Filters
        </button>
        {#if scanState.running}
          <button class="bs-refresh bs-scan-progress" title="Cancel the GitHub scan" onclick={() => plugin.cancelCatalogScan()}>
            <Icon name="loader" />Scanning {scanState.done.toLocaleString()}/{scanState.total.toLocaleString()} · Cancel
          </button>
        {:else}
          <button
            class="bs-refresh"
            title={hasToken
              ? "Fetch GitHub stars & open issues for the whole catalog so you can sort by them"
              : "Link a GitHub token in settings to scan the catalog (the 60/hour anonymous limit is too low)"}
            disabled={!hasToken}
            onclick={startScan}
          >
            <Icon name="github" />Scan GitHub
          </button>
        {/if}
        <button
          class="bs-refresh"
          title={layout === "grid" ? "Switch to tree view" : "Switch to grid view"}
          aria-label={layout === "grid" ? "Switch to tree view" : "Switch to grid view"}
          onclick={toggleLayout}
        >
          <Icon name={layout === "grid" ? "list-tree" : "layout-grid"} />{layout === "grid" ? "Tree" : "Grid"}
        </button>
      {/if}
      <button class="bs-refresh" title="Refresh catalog" onclick={() => void load(true)} disabled={loading}>
        <Icon name="refresh-cw" />Refresh
      </button>
    </div>
  </header>

  {#if stale}
    <div class="bs-banner">Showing cached data — the registry could not be refreshed.</div>
  {/if}

  {#if requestedSort === "trending" && !loading && !trendingReady}
    <div class="bs-banner bs-banner-info">
      Trending compares download counts across catalog refreshes, so it needs a couple of days of history — sorted by downloads for now.
    </div>
  {/if}

  {#if loading}
    <div class="bs-body" aria-label="Loading plugin catalog">
      <main class="bs-main">
        <div class="bs-grid" aria-hidden="true">
          {#each Array(12) as _, i (i)}
            <div class="bs-card bs-skeleton-card">
              <div class="bs-skel" style="width:55%"></div>
              <div class="bs-skel bs-skel-thin" style="width:90%"></div>
              <div class="bs-skel bs-skel-thin" style="width:70%"></div>
              <div class="bs-skel bs-skel-chip"></div>
            </div>
          {/each}
        </div>
      </main>
    </div>
  {:else if error}
    <div class="bs-status bs-error">Failed to load the plugin catalog: {error}</div>
  {:else if tab === "installed"}
    <div class="bs-body">
      <main class="bs-main">
        <InstalledTab {plugin} {entries} onSelect={(entry) => (selected = entry)} />
      </main>
      {#if selected}
        <DetailPane
          {plugin}
          {view}
          refreshTick={tokenTick}
          entry={selected}
          installed={installedIds.has(selected.id)}
          starred={favoriteIds.has(selected.id)}
          {similar}
          onSelectEntry={(entry) => (selected = entry)}
          onToggleStar={() => void toggleFavorite(selected!.id)}
          onDrillAuthor={drillAuthor}
          onClose={() => (selected = null)}
        />
      {/if}
    </div>
  {:else}
    <div class="bs-body" class:bs-filters-open={showFilters}>
      <FilterSidebar
        {filters}
        showSort={tab === "all"}
        presets={filterPresets}
        onChange={(next) => { filters = next; renderLimit = PAGE_SIZE; }}
        onSavePreset={savePreset}
      />
      <main class="bs-main">
        {#if filters.author}
          <div class="bs-author-filter">
            <Icon name="user" />
            <span>Plugins by <strong>{filters.author}</strong></span>
            <button class="bs-author-clear" title="Clear author filter" aria-label="Clear author filter" onclick={clearAuthor}>
              <Icon name="x" />
            </button>
          </div>
        {/if}
        <div class="bs-count">{visible.length.toLocaleString()} plugins</div>
        {#if visible.length === 0}
          <div class="bs-empty">
            <Icon name="search-x" />
            <p>No plugins match the current filters.</p>
            <button class="bs-empty-clear" onclick={resetFilters}>Clear filters</button>
          </div>
        {:else if tree}
          {#key effectiveFilters.sort}
            <TreeView
              model={tree}
              sort={effectiveFilters.sort}
              {plugin}
              {selected}
              {installedIds}
              onSelect={(entry) => (selected = entry)}
            />
          {/key}
        {:else}
          <div class="bs-grid" use:gridNav>
            {#each shown as entry (entry.id)}
              <PluginCard
                {entry}
                installed={installedIds.has(entry.id)}
                selected={selected?.id === entry.id}
                starred={favoriteIds.has(entry.id)}
                isNew={showNewBadges && newIds.has(entry.id)}
                stars={cardStars.get(entry.id) ?? repoStats[entry.repo]?.stars}
                onSelect={() => (selected = entry)}
                onToggleStar={() => void toggleFavorite(entry.id)}
                onIgnore={(e) => openIgnoreMenu(e, entry)}
                onAuthor={() => drillAuthor(entry.author)}
              />
            {/each}
          </div>
          {#if renderLimit < visible.length}
            <div class="bs-load-more" use:loadMoreSentinel>
              Showing {renderLimit.toLocaleString()} of {visible.length.toLocaleString()} — scroll for more
            </div>
          {/if}
        {/if}
      </main>
      {#if selected}
        <DetailPane
          {plugin}
          {view}
          refreshTick={tokenTick}
          entry={selected}
          installed={installedIds.has(selected.id)}
          starred={favoriteIds.has(selected.id)}
          {similar}
          onSelectEntry={(entry) => (selected = entry)}
          onToggleStar={() => void toggleFavorite(selected!.id)}
          onDrillAuthor={drillAuthor}
          onClose={() => (selected = null)}
        />
      {/if}
    </div>
  {/if}
</div>
