<script lang="ts">
  import { untrack } from "svelte";
  import { MarkdownRenderer } from "obsidian";
  import type BetterStorePlugin from "../main";
  import type { BetterStoreView } from "../view";
  import type { PluginEntry } from "../data/types";
  import { RateLimitError, type Enrichment } from "../data/service";
  import { rewriteReadmeUrls } from "../data/readme";
  import { formatAge, formatCount } from "../data/format";

  let {
    plugin,
    view,
    entry,
    onClose,
  }: { plugin: BetterStorePlugin; view: BetterStoreView; entry: PluginEntry; onClose: () => void } = $props();

  let readmeEl: HTMLElement | undefined = $state();
  let enrichment = $state<Enrichment | null>(null);
  let enrichError = $state<string | null>(null);
  let readmeLoading = $state(true);

  $effect(() => {
    const current = entry;
    const el = readmeEl;
    if (!el) return;
    untrack(() => void loadDetails(current, el));
  });

  async function loadDetails(current: PluginEntry, el: HTMLElement): Promise<void> {
    readmeLoading = true;
    enrichment = null;
    enrichError = null;
    el.empty();

    try {
      const md = rewriteReadmeUrls(await plugin.service.getReadme(current.repo), current.repo);
      if (current.id !== entry.id) return; // user switched plugins mid-fetch
      await MarkdownRenderer.render(plugin.app, md, el, "", view);
    } catch {
      if (current.id === entry.id) el.createEl("p", { text: current.description });
    } finally {
      if (current.id === entry.id) readmeLoading = false;
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
</script>

<aside class="bs-detail">
  <div class="bs-detail-header">
    <div class="bs-detail-title">
      <h3>{entry.name}</h3>
      <span class="bs-detail-author">by {entry.author}</span>
    </div>
    <button class="bs-detail-close" title="Close" onclick={onClose}>✕</button>
  </div>

  <div class="bs-detail-stats">
    <span title="Downloads">⬇ {formatCount(entry.downloads)}</span>
    <span title="Last updated">🕐 {formatAge(entry.updated, Date.now())}</span>
    {#if enrichment}
      <span title="GitHub stars">★ {formatCount(enrichment.stars)}</span>
      <span title="Open issues">⚑ {formatCount(enrichment.openIssues)}</span>
    {/if}
  </div>

  <div class="bs-detail-actions">
    <button class="mod-cta" onclick={openNative}>Open in Community Plugins</button>
    <a href={`https://github.com/${entry.repo}`} target="_blank" rel="noopener">Repository</a>
    {#if enrichment?.fundingUrl}
      <a href={enrichment.fundingUrl} target="_blank" rel="noopener">Support author</a>
    {/if}
  </div>

  {#if enrichError}
    <div class="bs-detail-note">{enrichError}</div>
  {/if}

  {#if enrichment && enrichment.releases.length > 0}
    <details class="bs-releases">
      <summary>Recent releases</summary>
      <ul>
        {#each enrichment.releases as r (r.tag)}
          <li><a href={r.url} target="_blank" rel="noopener">{r.tag}</a> — {r.publishedAt.slice(0, 10)}</li>
        {/each}
      </ul>
    </details>
  {/if}

  {#if readmeLoading}
    <div class="bs-status">Loading README…</div>
  {/if}
  <div class="bs-readme" bind:this={readmeEl}></div>
</aside>
