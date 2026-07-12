<script lang="ts">
  import type { PluginEntry } from "../data/types";
  import { formatAge, formatCount } from "../data/format";
  import Icon from "./Icon.svelte";

  let {
    entry,
    installed,
    selected,
    starred,
    isNew,
    stars,
    onSelect,
    onToggleStar,
    onIgnore,
    onAuthor,
  }: {
    entry: PluginEntry;
    installed: boolean;
    selected: boolean;
    starred: boolean;
    isNew: boolean;
    /** GitHub star count; undefined while unknown (no token or still loading). */
    stars?: number;
    onSelect: () => void;
    onToggleStar: () => void;
    onIgnore: (e: MouseEvent) => void;
    onAuthor: () => void;
  } = $props();
</script>

<div
  class="bs-card"
  class:bs-card-selected={selected}
  role="button"
  tabindex="0"
  onclick={onSelect}
  onkeydown={(e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }}
>
  <div class="bs-card-top">
    <span class="bs-card-name">{entry.name}</span>
    {#if isNew}<span class="bs-badge bs-badge-new">New</span>{/if}
    {#if installed}<span class="bs-badge bs-badge-installed">Installed</span>{/if}
    <button
      class="bs-star"
      class:bs-star-active={starred}
      title={starred ? "Unstar" : "Star"}
      aria-label={starred ? `Unstar ${entry.name}` : `Star ${entry.name}`}
      aria-pressed={starred}
      onclick={(e) => { e.stopPropagation(); onToggleStar(); }}
    ><Icon name="star" /></button>
    <button
      class="bs-ignore"
      title="Ignore options"
      aria-label={`Ignore options for ${entry.name}`}
      onclick={(e) => { e.stopPropagation(); onIgnore(e); }}
    ><Icon name="x" /></button>
  </div>
  <div class="bs-card-meta">
    <span title="Downloads"><Icon name="download" />{formatCount(entry.downloads)}</span>
    {#if stars != null && stars > 0}<span title="GitHub stars"><Icon name="star" />{formatCount(stars)}</span>{/if}
    <button
      class="bs-author-link"
      title={`Show all plugins by ${entry.author}`}
      onclick={(e) => { e.stopPropagation(); onAuthor(); }}
    >{entry.author}</button>
    <span>{formatAge(entry.updated, Date.now())}</span>
  </div>
  <p class="bs-card-desc">{entry.description}</p>
  <div class="bs-card-cats">
    {#each entry.categories as cat (cat)}<span class="bs-chip bs-chip-small">{cat}</span>{/each}
  </div>
</div>
