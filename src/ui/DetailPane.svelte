<script lang="ts">
  import { untrack } from "svelte";
  import { apiVersion, MarkdownRenderer, Notice, sanitizeHTMLToDom } from "obsidian";
  import type BetterStorePlugin from "../main";
  import type { BetterStoreView } from "../view";
  import type { PluginEntry } from "../data/types";
  import { RateLimitError, type Enrichment } from "../data/service";
  import { rewriteReadmeUrls } from "../data/readme";
  import { formatAge, formatCount } from "../data/format";
  import { compareVersions } from "../data/versions";
  import { assessHealth } from "../data/health";
  import Icon from "./Icon.svelte";
  import Sparkline from "./Sparkline.svelte";

  let {
    plugin,
    view,
    entry,
    installed,
    starred,
    similar,
    refreshTick = 0,
    onSelectEntry,
    onToggleStar,
    onClose,
  }: {
    plugin: BetterStorePlugin;
    view: BetterStoreView;
    entry: PluginEntry;
    installed: boolean;
    starred: boolean;
    similar: PluginEntry[];
    /** Bump to re-fetch GitHub data (e.g. after a token is linked). */
    refreshTick?: number;
    onSelectEntry: (entry: PluginEntry) => void;
    onToggleStar: () => void;
    onClose: () => void;
  } = $props();

  let readmeEl: HTMLElement | undefined = $state();
  let enrichment = $state<Enrichment | null>(null);
  let enrichError = $state<string | null>(null);
  let readmeLoading = $state(true);
  let sparkPoints = $state<{ ts: number; downloads: number }[]>([]);

  const MIN_WIDTH = 300;
  const MAX_WIDTH = 900;

  function loadWidth(): number {
    const stored = plugin.settings.ui.detailWidth;
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : 380;
  }

  let width = $state(loadWidth());

  function startResize(e: PointerEvent): void {
    e.preventDefault();
    // Bind to the view's own window — in a popout, the main window never
    // receives these pointer events.
    const win = (e.currentTarget as HTMLElement).ownerDocument.defaultView ?? window;
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: PointerEvent) => {
      width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (startX - ev.clientX)));
    };
    const onUp = () => {
      win.removeEventListener("pointermove", onMove);
      win.removeEventListener("pointerup", onUp);
      plugin.settings.ui.detailWidth = Math.round(width);
      void plugin.saveSettings();
    };
    win.addEventListener("pointermove", onMove);
    win.addEventListener("pointerup", onUp);
  }

  $effect(() => {
    const current = entry;
    const el = readmeEl;
    void refreshTick; // re-fetch when a newly linked token unlocks GitHub data
    if (!el) return;
    untrack(() => void loadDetails(current, el));
  });

  async function loadDetails(current: PluginEntry, el: HTMLElement): Promise<void> {
    readmeLoading = true;
    enrichment = null;
    enrichError = null;
    sparkPoints = [];
    el.empty();

    try {
      const md = rewriteReadmeUrls(await plugin.service.getReadme(current.repo), current.repo);
      if (current.id !== entry.id) return; // user switched plugins mid-fetch
      await MarkdownRenderer.render(plugin.app, md, el, "", view);
      if (current.id !== entry.id) return; // user switched plugins mid-render
      const rendered = el.innerHTML;
      el.empty();
      el.appendChild(sanitizeHTMLToDom(rendered));
    } catch {
      if (current.id === entry.id) el.createEl("p", { text: current.description });
    } finally {
      if (current.id === entry.id) readmeLoading = false;
    }

    if (plugin.settings.showSparkline) {
      try {
        const points = await plugin.service.getDownloadHistory(current.id);
        if (current.id === entry.id) sparkPoints = points;
      } catch {
        // sparkline is optional
      }
    }

    try {
      const e = await plugin.service.getEnrichment(current.repo);
      if (current.id === entry.id) enrichment = e;
    } catch (err) {
      if (current.id === entry.id) {
        enrichError = err instanceof RateLimitError ? err.message : "GitHub data unavailable.";
      }
    }
  }

  function openNative(): void {
    window.open(`obsidian://show-plugin?id=${encodeURIComponent(entry.id)}`);
  }

  async function copyText(text: string, label: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    new Notice(`Copied ${label}.`);
  }

  let incompatible = $derived(
    enrichment?.minAppVersion != null && compareVersions(enrichment.minAppVersion, apiVersion) > 0
  );

  let health = $derived(
    plugin.settings.showHealth && enrichment
      ? assessHealth({ updated: entry.updated, releases: enrichment.releases, now: Date.now() })
      : null
  );

  const HEALTH_LABEL = { healthy: "Actively maintained", aging: "Aging", "at-risk": "At risk" } as const;
  const HEALTH_ICON = { healthy: "check-circle", aging: "clock", "at-risk": "alert-triangle" } as const;

  /** Render a release's markdown notes with the same sanitize pass as the README. */
  function releaseNotes(node: HTMLElement, body: string) {
    if (!body.trim()) {
      node.createEl("p", { text: "No release notes provided.", cls: "bs-detail-note" });
      return;
    }
    void MarkdownRenderer.render(plugin.app, rewriteReadmeUrls(body, entry.repo), node, "", view).then(() => {
      const rendered = node.innerHTML;
      node.empty();
      node.appendChild(sanitizeHTMLToDom(rendered));
    });
  }
</script>

<aside class="bs-detail" style={`width:${width}px`}>
  <div
    class="bs-detail-resize"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize details panel"
    title="Drag to resize"
    onpointerdown={startResize}
  ></div>
  <div class="bs-detail-header">
    <div class="bs-detail-title">
      <h3>
        {entry.name}
        {#if installed}<span class="bs-badge bs-badge-installed">Installed</span>{/if}
      </h3>
      <span class="bs-detail-author">by {entry.author}</span>
    </div>
    <div class="bs-detail-header-actions">
      <button
        class="bs-star"
        class:bs-star-active={starred}
        title={starred ? "Unstar" : "Star"}
        aria-label={starred ? `Unstar ${entry.name}` : `Star ${entry.name}`}
        aria-pressed={starred}
        onclick={onToggleStar}
      ><Icon name="star" /></button>
      <button class="bs-detail-close" title="Close" aria-label="Close details" onclick={onClose}><Icon name="x" /></button>
    </div>
  </div>

  <div class="bs-detail-stats">
    <span title="Downloads"><Icon name="download" />{formatCount(entry.downloads)}</span>
    <span title="Last updated"><Icon name="clock" />{formatAge(entry.updated, Date.now())}</span>
    {#if enrichment}
      <span title="GitHub stars"><Icon name="star" />{formatCount(enrichment.stars)}</span>
      <span title="Open issues"><Icon name="circle-dot" />{formatCount(enrichment.openIssues)}</span>
    {/if}
  </div>

  {#if health}
    <div class={`bs-health bs-health-${health.level}`} title={health.reasons.join(" · ")}>
      <Icon name={HEALTH_ICON[health.level]} />
      {HEALTH_LABEL[health.level]}
    </div>
  {/if}

  {#if sparkPoints.length >= 2}
    <Sparkline points={sparkPoints} />
  {/if}

  {#if incompatible && enrichment}
    <div class="bs-compat-warning">
      <Icon name="alert-triangle" />
      Requires Obsidian {enrichment.minAppVersion} or newer — you're on {apiVersion}.
    </div>
  {/if}

  <div class="bs-detail-actions">
    <button class="mod-cta" onclick={openNative}>
      {installed ? "Open in Community Plugins" : "Install via Community Plugins"}
    </button>
    <a href={`https://github.com/${entry.repo}`} target="_blank" rel="noopener">Repository</a>
    {#if enrichment?.fundingUrl}
      <a href={enrichment.fundingUrl} target="_blank" rel="noopener">Support author</a>
    {/if}
    <span class="bs-copy-actions">
      <button
        class="bs-copy-btn"
        title="Copy repository URL"
        aria-label="Copy repository URL"
        onclick={() => void copyText(`https://github.com/${entry.repo}`, "repository URL")}
      ><Icon name="link" /></button>
      <button
        class="bs-copy-btn"
        title="Copy BRAT string"
        aria-label="Copy BRAT string"
        onclick={() => void copyText(entry.repo, "BRAT string")}
      ><Icon name="clipboard-copy" /></button>
    </span>
  </div>

  <div class="bs-card-cats">
    {#each entry.categories as cat (cat)}<span class="bs-chip bs-chip-small">{cat}</span>{/each}
  </div>

  {#if enrichError}
    <div class="bs-detail-note">{enrichError}</div>
  {/if}

  {#if similar.length > 0}
    <div class="bs-similar">
      <span class="bs-field-label">Similar plugins</span>
      <div class="bs-cats">
        {#each similar as s (s.id)}
          <button class="bs-chip" onclick={() => onSelectEntry(s)}>{s.name}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#if enrichment && enrichment.releases.length > 0}
    <details class="bs-releases">
      <summary>Recent releases</summary>
      <div class="bs-release-list">
        {#each enrichment.releases as r, i (i)}
          <details class="bs-release">
            <summary>
              <a href={r.url} target="_blank" rel="noopener" onclick={(e) => e.stopPropagation()}>{r.tag}</a>
              <span class="bs-release-date">{r.publishedAt.slice(0, 10)}</span>
            </summary>
            <div class="bs-release-notes" use:releaseNotes={r.body}></div>
          </details>
        {/each}
      </div>
    </details>
  {/if}

  {#if readmeLoading}
    <div class="bs-status">Loading README…</div>
  {/if}
  <div class="bs-readme" bind:this={readmeEl}></div>
</aside>
