import { describe, it, expect } from "vitest";
import { buildTree } from "../src/data/tree";
import type { PluginEntry } from "../src/data/types";

const DAY = 86_400_000;
const NOW = 1_750_000_000_000;

function entry(overrides: Partial<PluginEntry>): PluginEntry {
  return {
    id: "x", name: "X", author: "A", description: "", repo: "a/x",
    downloads: 0, updated: NOW, categories: ["Other"],
    ...overrides,
  };
}

describe("buildTree — downloads grouping", () => {
  it("buckets by download count in descending bucket order, omitting empty buckets", () => {
    const entries = [
      entry({ id: "a", downloads: 3_400_000 }),
      entry({ id: "b", downloads: 1_200_000 }),
      entry({ id: "c", downloads: 800_000 }),
      entry({ id: "d", downloads: 5_000 }),
    ];
    const tree = buildTree(entries, "downloads", { now: NOW, trendingDeltas: {}, repoStats: {} });
    expect(tree.groups.map((g) => g.label)).toEqual(["3M+", "1M+", "500k+", "Under 10k"]);
    expect(tree.groups[0].entries.map((e) => e.id)).toEqual(["a"]);
    expect(tree.groups[2].entries.map((e) => e.id)).toEqual(["c"]);
  });

  it("preserves incoming order within a bucket", () => {
    const entries = [
      entry({ id: "first", downloads: 200_000 }),
      entry({ id: "second", downloads: 150_000 }),
    ];
    const tree = buildTree(entries, "downloads", { now: NOW, trendingDeltas: {}, repoStats: {} });
    expect(tree.groups[0].entries.map((e) => e.id)).toEqual(["first", "second"]);
  });
});

describe("buildTree — stale split", () => {
  it("moves stale plugins (12+ months) into stale groups with the same bucket layout", () => {
    const entries = [
      entry({ id: "fresh", downloads: 1_500_000, updated: NOW - 10 * DAY }),
      entry({ id: "old", downloads: 1_500_000, updated: NOW - 400 * DAY }),
    ];
    const tree = buildTree(entries, "downloads", { now: NOW, trendingDeltas: {}, repoStats: {} });
    expect(tree.groups.map((g) => g.label)).toEqual(["1M+"]);
    expect(tree.groups[0].entries.map((e) => e.id)).toEqual(["fresh"]);
    expect(tree.stale.map((g) => g.label)).toEqual(["1M+"]);
    expect(tree.stale[0].entries.map((e) => e.id)).toEqual(["old"]);
  });

  it("does not split stale for the updated sort (recency buckets already cover it)", () => {
    const entries = [entry({ id: "old", updated: NOW - 400 * DAY })];
    const tree = buildTree(entries, "updated", { now: NOW, trendingDeltas: {}, repoStats: {} });
    expect(tree.stale).toEqual([]);
    expect(tree.groups.map((g) => g.label)).toEqual(["Older"]);
  });

  it("treats unknown update dates as not stale", () => {
    const entries = [entry({ id: "u", downloads: 20_000, updated: 0 })];
    const tree = buildTree(entries, "downloads", { now: NOW, trendingDeltas: {}, repoStats: {} });
    expect(tree.stale).toEqual([]);
    expect(tree.groups[0].entries.map((e) => e.id)).toEqual(["u"]);
  });
});

describe("buildTree — updated grouping", () => {
  it("buckets by recency with Unknown last", () => {
    const entries = [
      entry({ id: "wk", updated: NOW - 2 * DAY }),
      entry({ id: "mo", updated: NOW - 20 * DAY }),
      entry({ id: "q", updated: NOW - 80 * DAY }),
      entry({ id: "half", updated: NOW - 150 * DAY }),
      entry({ id: "yr", updated: NOW - 300 * DAY }),
      entry({ id: "old", updated: NOW - 800 * DAY }),
      entry({ id: "unk", updated: 0 }),
    ];
    const tree = buildTree(entries, "updated", { now: NOW, trendingDeltas: {}, repoStats: {} });
    expect(tree.groups.map((g) => g.label)).toEqual([
      "This week", "This month", "Last 3 months", "Last 6 months", "This year", "Older", "Unknown",
    ]);
  });
});

describe("buildTree — name grouping", () => {
  it("buckets by first letter with # for non-letters", () => {
    const entries = [
      entry({ id: "a1", name: "Advanced Tables" }),
      entry({ id: "b1", name: "BRAT" }),
      entry({ id: "n1", name: "1Password Helper" }),
    ];
    const tree = buildTree(entries, "name", { now: NOW, trendingDeltas: {}, repoStats: {} });
    expect(tree.groups.map((g) => g.label)).toEqual(["A", "B", "#"]);
  });
});

describe("buildTree — trending grouping", () => {
  it("buckets by download delta", () => {
    const entries = [
      entry({ id: "hot", downloads: 1 }),
      entry({ id: "warm", downloads: 1 }),
      entry({ id: "flat", downloads: 1 }),
    ];
    const deltas = { hot: 120_000, warm: 2_500 };
    const tree = buildTree(entries, "trending", { now: NOW, trendingDeltas: deltas, repoStats: {} });
    expect(tree.groups.map((g) => g.label)).toEqual(["+100k or more", "+1k or more", "No recent growth"]);
  });
});

describe("buildTree — stars grouping", () => {
  it("buckets by scanned star tiers, with unscanned repos grouped last", () => {
    const entries = [
      entry({ id: "big", repo: "o/big", downloads: 1 }),
      entry({ id: "mid", repo: "o/mid", downloads: 1 }),
      entry({ id: "unscanned", repo: "o/unscanned", downloads: 1 }),
    ];
    const repoStats = {
      "o/big": { stars: 12_000, openIssues: 3, createdAt: 0 },
      "o/mid": { stars: 250, openIssues: 40, createdAt: 0 },
    };
    const tree = buildTree(entries, "stars", { now: NOW, trendingDeltas: {}, repoStats });
    expect(tree.groups.map((g) => g.label)).toEqual(["10k+ stars", "100+ stars", "Not scanned yet"]);
    expect(tree.groups[2].entries.map((e) => e.id)).toEqual(["unscanned"]);
  });
});

describe("buildTree — recently added grouping", () => {
  it("buckets by repo creation recency, with unscanned/undated grouped last", () => {
    const entries = [
      entry({ id: "new", repo: "o/new", downloads: 1 }),
      entry({ id: "old", repo: "o/old", downloads: 1 }),
      entry({ id: "undated", repo: "o/undated", downloads: 1 }),
    ];
    const repoStats = {
      "o/new": { stars: 1, openIssues: 0, createdAt: NOW - 10 * DAY },
      "o/old": { stars: 1, openIssues: 0, createdAt: NOW - 800 * DAY },
      "o/undated": { stars: 1, openIssues: 0, createdAt: 0 },
    };
    const tree = buildTree(entries, "added", { now: NOW, trendingDeltas: {}, repoStats });
    expect(tree.groups.map((g) => g.label)).toEqual(["Added this month", "Added over a year ago", "Not scanned yet"]);
    expect(tree.groups[2].entries.map((e) => e.id)).toEqual(["undated"]);
  });
});
