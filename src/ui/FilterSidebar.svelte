<script lang="ts">
  import { ALL_CATEGORIES } from "../data/categories";
  import type { FilterState, SortKey } from "../data/filter";

  let {
    filters,
    showSort,
    onChange,
  }: { filters: FilterState; showSort: boolean; onChange: (next: FilterState) => void } = $props();

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "downloads", label: "Downloads" },
    { key: "updated", label: "Recently updated" },
    { key: "name", label: "Name" },
    { key: "trending", label: "Trending" },
  ];

  const UPDATED_OPTIONS: { value: number | null; label: string }[] = [
    { value: null, label: "Any time" },
    { value: 3, label: "Last 3 months" },
    { value: 6, label: "Last 6 months" },
    { value: 12, label: "Last 12 months" },
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
    <span class="bs-field-label">Updated</span>
    <select
      class="dropdown"
      value={String(filters.updatedWithinMonths)}
      onchange={(e) => {
        const v = e.currentTarget.value;
        onChange({ ...filters, updatedWithinMonths: v === "null" ? null : Number(v) });
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

  <label class="bs-field bs-field-row">
    <input
      type="checkbox"
      checked={filters.hideInstalled}
      onchange={(e) => onChange({ ...filters, hideInstalled: e.currentTarget.checked })}
    />
    <span>Hide installed</span>
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
