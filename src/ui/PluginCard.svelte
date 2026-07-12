<script lang="ts">
  import type { PluginEntry } from "../data/types";
  import { formatAge, formatCount } from "../data/format";
  import Icon from "./Icon.svelte";

  let {
    entry,
    installed,
    selected,
    onSelect,
    onIgnore,
  }: {
    entry: PluginEntry;
    installed: boolean;
    selected: boolean;
    onSelect: () => void;
    onIgnore: () => void;
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
    {#if installed}<span class="bs-badge bs-badge-installed">Installed</span>{/if}
    <button
      class="bs-ignore"
      title="Ignore this plugin"
      aria-label="Ignore this plugin"
      onclick={(e) => { e.stopPropagation(); onIgnore(); }}
    ><Icon name="x" /></button>
  </div>
  <div class="bs-card-meta">
    <span>{entry.author}</span>
    <span title="Downloads"><Icon name="download" />{formatCount(entry.downloads)}</span>
    <span>{formatAge(entry.updated, Date.now())}</span>
  </div>
  <p class="bs-card-desc">{entry.description}</p>
  <div class="bs-card-cats">
    {#each entry.categories as cat (cat)}<span class="bs-chip bs-chip-small">{cat}</span>{/each}
  </div>
</div>
