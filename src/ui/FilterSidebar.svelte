<script lang="ts">
  import { ALL_CATEGORIES } from "../data/categories";
  import { EMPTY_FILTER, type FilterState, type SortKey } from "../data/filter";
  import type { FilterPreset } from "../settings";
  import Icon from "./Icon.svelte";

  let {
    filters,
    showSort,
    presets,
    onChange,
    onSavePreset,
  }: {
    filters: FilterState;
    showSort: boolean;
    presets: FilterPreset[];
    onChange: (next: FilterState) => void;
    onSavePreset: () => void;
  } = $props();

  function applyPreset(name: string): void {
    const preset = presets.find((p) => p.name === name);
    // Merge over defaults so presets saved before newer filter fields still apply cleanly.
    if (preset) onChange({ ...EMPTY_FILTER, ...preset.state });
  }

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "downloads", label: "Downloads" },
    { key: "updated", label: "Recently updated" },
    { key: "name", label: "Name" },
    { key: "trending", label: "Trending" },
    { key: "stars", label: "GitHub stars (scanned)" },
    { key: "issues", label: "Open issues (scanned)" },
    { key: "added", label: "Recently added (scanned)" },
  ];

  const UPDATED_OPTIONS: { value: number | null; label: string }[] = [
    { value: null, label: "Any time" },
    { value: 1, label: "Last 24 hours" },
    { value: 7, label: "Last 7 days" },
    { value: 30, label: "Last 30 days" },
    { value: 90, label: "Last 3 months" },
    { value: 365, label: "Last year" },
  ];

  function toggleCategory(cat: string): void {
    const categories = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories });
  }
</script>

<aside class="bs-sidebar">
  <input
    type="search"
    class="bs-search"
    placeholder="Search plugins…"
    aria-label="Search plugins"
    value={filters.query}
    oninput={(e) => onChange({ ...filters, query: e.currentTarget.value })}
  />

  <div class="bs-field">
    <span class="bs-field-label">Presets</span>
    <div class="bs-preset-row">
      {#if presets.length > 0}
        <select
          class="dropdown"
          aria-label="Apply filter preset"
          onchange={(e) => {
            applyPreset(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
        >
          <option value="" selected disabled>Apply preset…</option>
          {#each presets as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
        </select>
      {/if}
      <button
        class="bs-preset-save"
        title="Save current filters as a preset"
        aria-label="Save current filters as a preset"
        onclick={onSavePreset}
      ><Icon name="save" /></button>
    </div>
  </div>

  {#if showSort}
    <label class="bs-field">
      <span class="bs-field-label">Sort by</span>
      <select
        class="dropdown"
        value={filters.sort}
        onchange={(e) => onChange({ ...filters, sort: e.currentTarget.value as SortKey })}
      >
        {#each SORTS as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
      </select>
    </label>
  {/if}

  <label class="bs-field">
    <span class="bs-field-label">Updated within</span>
    <select
      class="dropdown"
      value={String(filters.updatedWithinDays)}
      onchange={(e) => {
        const v = e.currentTarget.value;
        onChange({ ...filters, updatedWithinDays: v === "null" ? null : Number(v) });
      }}
    >
      {#each UPDATED_OPTIONS as o (String(o.value))}<option value={String(o.value)}>{o.label}</option>{/each}
    </select>
  </label>

  <label class="bs-field">
    <span class="bs-field-label">Min downloads</span>
    <input
      type="number"
      min="0"
      step="1000"
      value={filters.minDownloads}
      oninput={(e) => onChange({ ...filters, minDownloads: Number(e.currentTarget.value) || 0 })}
    />
  </label>

  <label class="bs-field">
    <span class="bs-field-label">Min stars (scanned)</span>
    <input
      type="number"
      min="0"
      step="100"
      value={filters.minStars}
      oninput={(e) => onChange({ ...filters, minStars: Number(e.currentTarget.value) || 0 })}
    />
  </label>

  <label class="bs-field bs-field-row">
    <input
      type="checkbox"
      checked={filters.hideInstalled}
      onchange={(e) => onChange({ ...filters, hideInstalled: e.currentTarget.checked })}
    />
    <span>Hide installed</span>
  </label>

  <label class="bs-field bs-field-row">
    <input
      type="checkbox"
      checked={filters.starredOnly}
      onchange={(e) => onChange({ ...filters, starredOnly: e.currentTarget.checked })}
    />
    <span>Starred only</span>
  </label>

  <label class="bs-field bs-field-row">
    <input
      type="checkbox"
      checked={filters.newOnly}
      onchange={(e) => onChange({ ...filters, newOnly: e.currentTarget.checked })}
    />
    <span>New only</span>
  </label>

  <div class="bs-field">
    <span class="bs-field-label">Categories</span>
    <div class="bs-cats">
      {#each ALL_CATEGORIES as cat (cat)}
        <button
          class="bs-chip"
          class:bs-chip-active={filters.categories.includes(cat)}
          onclick={() => toggleCategory(cat)}
        >{cat}</button>
      {/each}
    </div>
  </div>
</aside>
