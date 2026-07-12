import type { PluginEntry } from "./types";

export type SortKey = "downloads" | "updated" | "name" | "trending" | "stars" | "issues";

export interface FilterState {
  query: string;
  /** Selected categories; empty means "all". Plugins matching ANY selected category pass. */
  categories: string[];
  sort: SortKey;
  /** null = no limit. Filters on the plugin's last-release timestamp. */
  releasedWithinDays: number | null;
  minDownloads: number;
  /** Minimum GitHub stars (needs scanned data; unscanned plugins count as 0). */
  minStars: number;
  hideInstalled: boolean;
  /** Only plugins the user has starred. */
  starredOnly: boolean;
  /** Only plugins that recently appeared in the registry. */
  newOnly: boolean;
  /** Exact author name to drill into; empty means all authors. */
  author: string;
}

export interface RepoStat {
  stars: number;
  openIssues: number;
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
  /** Scanned GitHub stats keyed by repo ("owner/name"); may be partial. */
  repoStats: Record<string, RepoStat>;
  now: number;
}

export const EMPTY_FILTER: FilterState = {
  query: "",
  categories: [],
  sort: "downloads",
  releasedWithinDays: null,
  minDownloads: 0,
  minStars: 0,
  hideInstalled: false,
  starredOnly: false,
  newOnly: false,
  author: "",
};

const DAY_MS = 86_400_000;

export function filterPlugins(entries: PluginEntry[], state: FilterState, ctx: FilterContext): PluginEntry[] {
  const q = state.query.trim().toLowerCase();
  const cutoff = state.releasedWithinDays == null ? null : ctx.now - state.releasedWithinDays * DAY_MS;
  const stars = (e: PluginEntry): number => ctx.repoStats[e.repo]?.stars ?? -1;
  const issues = (e: PluginEntry): number => ctx.repoStats[e.repo]?.openIssues ?? -1;

  const filtered = entries.filter((e) => {
    if (ctx.ignoredIds.has(e.id)) return false;
    if (ctx.ignoredAuthors.has(e.author)) return false;
    if (e.categories.some((c) => ctx.ignoredCategories.has(c))) return false;
    if (state.starredOnly && !ctx.favoriteIds.has(e.id)) return false;
    if (state.newOnly && !ctx.newIds.has(e.id)) return false;
    if (state.author && e.author !== state.author) return false;
    if (state.hideInstalled && ctx.installedIds.has(e.id)) return false;
    if (e.downloads < state.minDownloads) return false;
    if (state.minStars > 0 && (ctx.repoStats[e.repo]?.stars ?? 0) < state.minStars) return false;
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
    // Unscanned plugins (-1) sort to the bottom of a stars/issues sort.
    stars: (a, b) => stars(b) - stars(a),
    issues: (a, b) => issues(b) - issues(a),
  };

  return filtered.sort(comparators[state.sort]);
}
