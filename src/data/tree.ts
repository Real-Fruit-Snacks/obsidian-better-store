import type { PluginEntry } from "./types";
import type { SortKey } from "./filter";

export interface TreeGroup {
  label: string;
  entries: PluginEntry[];
}

export interface TreeModel {
  groups: TreeGroup[];
  /** Stale plugins (12+ months without an update) in the same bucket layout.
   * Empty for the "updated" sort, whose recency buckets already express staleness. */
  stale: TreeGroup[];
}

export interface TreeContext {
  now: number;
  trendingDeltas: Record<string, number>;
  repoStats: Record<string, { stars: number; openIssues: number }>;
}

const DAY = 86_400_000;
const STALE_MS = 365 * DAY;

const DOWNLOAD_BUCKETS = [
  { min: 3_000_000, label: "3M+" },
  { min: 2_000_000, label: "2M+" },
  { min: 1_000_000, label: "1M+" },
  { min: 500_000, label: "500k+" },
  { min: 100_000, label: "100k+" },
  { min: 50_000, label: "50k+" },
  { min: 10_000, label: "10k+" },
  { min: 0, label: "Under 10k" },
] as const;

const UPDATED_BUCKETS = [
  { maxDays: 7, label: "This week" },
  { maxDays: 30, label: "This month" },
  { maxDays: 90, label: "Last 3 months" },
  { maxDays: 180, label: "Last 6 months" },
  { maxDays: 365, label: "This year" },
  { maxDays: Infinity, label: "Older" },
] as const;

const TRENDING_BUCKETS = [
  { min: 100_000, label: "+100k or more" },
  { min: 50_000, label: "+50k or more" },
  { min: 10_000, label: "+10k or more" },
  { min: 1_000, label: "+1k or more" },
  { min: 1, label: "Growing" },
  { min: -Infinity, label: "No recent growth" },
] as const;

const NAME_ORDER = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];

const STAR_BUCKETS = [
  { min: 10_000, label: "10k+ stars" },
  { min: 1_000, label: "1k+ stars" },
  { min: 100, label: "100+ stars" },
  { min: 1, label: "Under 100 stars" },
  { min: 0, label: "No stars" },
] as const;

const ISSUE_BUCKETS = [
  { min: 100, label: "100+ open issues" },
  { min: 10, label: "10+ open issues" },
  { min: 1, label: "1+ open issues" },
  { min: 0, label: "No open issues" },
] as const;

const NOT_SCANNED = "Not scanned yet";

function labelFor(entry: PluginEntry, sort: SortKey, ctx: TreeContext): string {
  switch (sort) {
    case "downloads":
      return DOWNLOAD_BUCKETS.find((b) => entry.downloads >= b.min)!.label;
    case "updated": {
      if (!entry.updated) return "Unknown";
      const days = (ctx.now - entry.updated) / DAY;
      return UPDATED_BUCKETS.find((b) => days <= b.maxDays)!.label;
    }
    case "trending": {
      const delta = ctx.trendingDeltas[entry.id] ?? 0;
      return TRENDING_BUCKETS.find((b) => delta >= b.min)!.label;
    }
    case "name": {
      const first = entry.name.trim().charAt(0).toUpperCase();
      return /[A-Z]/.test(first) ? first : "#";
    }
    case "stars": {
      const stat = ctx.repoStats[entry.repo];
      return stat == null ? NOT_SCANNED : STAR_BUCKETS.find((b) => stat.stars >= b.min)!.label;
    }
    case "issues": {
      const stat = ctx.repoStats[entry.repo];
      return stat == null ? NOT_SCANNED : ISSUE_BUCKETS.find((b) => stat.openIssues >= b.min)!.label;
    }
  }
}

function bucketOrder(sort: SortKey): readonly string[] {
  switch (sort) {
    case "downloads":
      return DOWNLOAD_BUCKETS.map((b) => b.label);
    case "updated":
      return [...UPDATED_BUCKETS.map((b) => b.label), "Unknown"];
    case "trending":
      return TRENDING_BUCKETS.map((b) => b.label);
    case "name":
      return NAME_ORDER;
    case "stars":
      return [...STAR_BUCKETS.map((b) => b.label), NOT_SCANNED];
    case "issues":
      return [...ISSUE_BUCKETS.map((b) => b.label), NOT_SCANNED];
  }
}

function groupInOrder(entries: PluginEntry[], sort: SortKey, ctx: TreeContext): TreeGroup[] {
  const byLabel = new Map<string, PluginEntry[]>();
  for (const e of entries) {
    const label = labelFor(e, sort, ctx);
    const bucket = byLabel.get(label);
    if (bucket) bucket.push(e);
    else byLabel.set(label, [e]);
  }
  return bucketOrder(sort)
    .filter((label) => byLabel.has(label))
    .map((label) => ({ label, entries: byLabel.get(label) as PluginEntry[] }));
}

/** Group already-filtered/sorted entries into explorer-style folders derived
 * from the active sort. Entry order within a group is preserved. */
export function buildTree(entries: PluginEntry[], sort: SortKey, ctx: TreeContext): TreeModel {
  if (sort === "updated") {
    return { groups: groupInOrder(entries, sort, ctx), stale: [] };
  }
  const fresh: PluginEntry[] = [];
  const stale: PluginEntry[] = [];
  for (const e of entries) {
    (e.updated > 0 && ctx.now - e.updated > STALE_MS ? stale : fresh).push(e);
  }
  return {
    groups: groupInOrder(fresh, sort, ctx),
    stale: groupInOrder(stale, sort, ctx),
  };
}
