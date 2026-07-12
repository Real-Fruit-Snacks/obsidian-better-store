import { describe, it, expect } from "vitest";
import { filterPlugins, EMPTY_FILTER, type FilterContext } from "../src/data/filter";
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

function ctx(overrides: Partial<FilterContext> = {}): FilterContext {
  return {
    installedIds: new Set(),
    ignoredIds: new Set(),
    ignoredAuthors: new Set(),
    ignoredCategories: new Set(),
    favoriteIds: new Set(),
    newIds: new Set(),
    trendingDeltas: {},
    now: NOW,
    ...overrides,
  };
}

const entries: PluginEntry[] = [
  entry({ id: "tasks", name: "Tasks", description: "task tracking", downloads: 900, categories: ["Tasks"] }),
  entry({ id: "ai-helper", name: "AI Helper", author: "Ann", downloads: 500, categories: ["AI"], updated: NOW - 400 * DAY }),
  entry({ id: "themer", name: "Themer", downloads: 100, categories: ["Appearance"], updated: NOW - 10 * DAY }),
];

describe("filterPlugins", () => {
  it("matches query against name, description, and author", () => {
    expect(filterPlugins(entries, { ...EMPTY_FILTER, query: "task" }, ctx()).map((e) => e.id)).toEqual(["tasks"]);
    expect(filterPlugins(entries, { ...EMPTY_FILTER, query: "ann" }, ctx()).map((e) => e.id)).toEqual(["ai-helper"]);
  });

  it("filters by category (OR across selected categories)", () => {
    const got = filterPlugins(entries, { ...EMPTY_FILTER, categories: ["Tasks", "AI"] }, ctx());
    expect(got.map((e) => e.id).sort()).toEqual(["ai-helper", "tasks"]);
  });

  it("applies minDownloads and updatedWithinMonths", () => {
    expect(filterPlugins(entries, { ...EMPTY_FILTER, minDownloads: 400 }, ctx()).map((e) => e.id)).toEqual(["tasks", "ai-helper"]);
    expect(filterPlugins(entries, { ...EMPTY_FILTER, updatedWithinMonths: 3 }, ctx()).map((e) => e.id)).toEqual(["tasks", "themer"]);
  });

  it("hides installed and ignored plugins", () => {
    const c = ctx({ installedIds: new Set(["tasks"]), ignoredIds: new Set(["themer"]) });
    const got = filterPlugins(entries, { ...EMPTY_FILTER, hideInstalled: true }, c);
    expect(got.map((e) => e.id)).toEqual(["ai-helper"]);
  });

  it("sorts by downloads desc, updated desc, name asc, trending desc", () => {
    expect(filterPlugins(entries, { ...EMPTY_FILTER, sort: "downloads" }, ctx()).map((e) => e.id)).toEqual(["tasks", "ai-helper", "themer"]);
    expect(filterPlugins(entries, { ...EMPTY_FILTER, sort: "updated" }, ctx()).map((e) => e.id)).toEqual(["tasks", "themer", "ai-helper"]);
    expect(filterPlugins(entries, { ...EMPTY_FILTER, sort: "name" }, ctx()).map((e) => e.id)).toEqual(["ai-helper", "tasks", "themer"]);
    const c = ctx({ trendingDeltas: { themer: 50, tasks: 10 } });
    expect(filterPlugins(entries, { ...EMPTY_FILTER, sort: "trending" }, c).map((e) => e.id)).toEqual(["themer", "tasks", "ai-helper"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...entries];
    filterPlugins(entries, { ...EMPTY_FILTER, sort: "name" }, ctx());
    expect(entries).toEqual(copy);
  });

  it("hides plugins by ignored author and ignored category", () => {
    const c = ctx({ ignoredAuthors: new Set(["Ann"]), ignoredCategories: new Set(["Appearance"]) });
    expect(filterPlugins(entries, EMPTY_FILTER, c).map((e) => e.id)).toEqual(["tasks"]);
  });

  it("starredOnly keeps only favorites", () => {
    const c = ctx({ favoriteIds: new Set(["themer"]) });
    expect(filterPlugins(entries, { ...EMPTY_FILTER, starredOnly: true }, c).map((e) => e.id)).toEqual(["themer"]);
  });

  it("newOnly keeps only recently added plugins", () => {
    const c = ctx({ newIds: new Set(["ai-helper"]) });
    expect(filterPlugins(entries, { ...EMPTY_FILTER, newOnly: true }, c).map((e) => e.id)).toEqual(["ai-helper"]);
  });

  it("author drill-down keeps only that author's plugins (exact match)", () => {
    expect(filterPlugins(entries, { ...EMPTY_FILTER, author: "Ann" }, ctx()).map((e) => e.id)).toEqual(["ai-helper"]);
    // Default author "A" is shared by the other two entries.
    expect(filterPlugins(entries, { ...EMPTY_FILTER, author: "A" }, ctx()).map((e) => e.id).sort()).toEqual(["tasks", "themer"]);
  });
});
