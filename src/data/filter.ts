import type { PluginEntry } from "./types";

export type SortKey = "downloads" | "updated" | "name" | "trending";

export interface FilterState {
  query: string;
  /** Selected categories; empty means "all". Plugins matching ANY selected category pass. */
  categories: string[];
  sort: SortKey;
  /** null = no limit. Months are approximated as 30 days. */
  updatedWithinMonths: number | null;
  minDownloads: number;
  hideInstalled: boolean;
  /** Only plugins the user has starred. */
  starredOnly: boolean;
  /** Only plugins that recently appeared in the registry. */
  newOnly: boolean;
  /** Exact author name to drill into; empty means all authors. */
  author: string;
}

export interface FilterContext {
  installedIds: Set<string>;
  ignoredIds: Set<string>;
  /** Authors whose plugins are hidden entirely. */
  ignoredAuthors: Set<string>;
  /** Categories that hide a plugin when ANY of its categories matches. */
  ignoredCategories: Set<string>;
  favoriteIds: Set<string>;
  newIds: Set<string>;
  trendingDeltas: Record<string, number>;
  now: number;
}

export const EMPTY_FILTER: FilterState = {
  query: "",
  categories: [],
  sort: "downloads",
  updatedWithinMonths: null,
  minDownloads: 0,
  hideInstalled: false,
  starredOnly: false,
  newOnly: false,
  author: "",
};

const MONTH_MS = 30 * 86_400_000;

export function filterPlugins(entries: PluginEntry[], state: FilterState, ctx: FilterContext): PluginEntry[] {
  const q = state.query.trim().toLowerCase();
  const cutoff = state.updatedWithinMonths == null ? null : ctx.now - state.updatedWithinMonths * MONTH_MS;

  const filtered = entries.filter((e) => {
    if (ctx.ignoredIds.has(e.id)) return false;
    if (ctx.ignoredAuthors.has(e.author)) return false;
    if (e.categories.some((c) => ctx.ignoredCategories.has(c))) return false;
    if (state.starredOnly && !ctx.favoriteIds.has(e.id)) return false;
    if (state.newOnly && !ctx.newIds.has(e.id)) return false;
    if (state.author && e.author !== state.author) return false;
    if (state.hideInstalled && ctx.installedIds.has(e.id)) return false;
    if (e.downloads < state.minDownloads) return false;
    if (cutoff != null && e.updated < cutoff) return false;
    if (state.categories.length > 0 && !state.categories.some((c) => e.categories.includes(c))) return false;
    if (
      q &&
      !e.name.toLowerCase().includes(q) &&
      !e.description.toLowerCase().includes(q) &&
      !e.author.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const comparators: Record<SortKey, (a: PluginEntry, b: PluginEntry) => number> = {
    downloads: (a, b) => b.downloads - a.downloads,
    updated: (a, b) => b.updated - a.updated,
    name: (a, b) => a.name.localeCompare(b.name),
    trending: (a, b) => (ctx.trendingDeltas[b.id] ?? 0) - (ctx.trendingDeltas[a.id] ?? 0),
  };

  return filtered.sort(comparators[state.sort]);
}
