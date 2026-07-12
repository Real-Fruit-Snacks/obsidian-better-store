import { describe, it, expect } from "vitest";
import { parseRegistry, slimStats, mergeRegistry } from "../src/data/registry";

const validEntry = {
  id: "dataview",
  name: "Dataview",
  author: "Michael Brenan",
  description: "Complex data views for the data-obsessed.",
  repo: "blacksmithgu/obsidian-dataview",
};

describe("parseRegistry", () => {
  it("parses valid entries", () => {
    expect(parseRegistry([validEntry])).toEqual([validEntry]);
  });

  it("skips malformed entries instead of throwing", () => {
    const raw = [
      validEntry,
      { id: "no-repo", name: "X", author: "Y", description: "Z" },
      null,
      "junk",
      { ...validEntry, id: 42 },
    ];
    expect(parseRegistry(raw)).toEqual([validEntry]);
  });

  it("returns empty array for non-array input", () => {
    expect(parseRegistry({ not: "an array" })).toEqual([]);
    expect(parseRegistry(null)).toEqual([]);
  });
});

describe("slimStats", () => {
  it("keeps only downloads and updated per plugin", () => {
    const raw = {
      dataview: { downloads: 3000000, updated: 1700000000000, "0.5.64": 120000 },
      "some-plugin": { downloads: 5, updated: 1600000000000 },
    };
    expect(slimStats(raw)).toEqual({
      dataview: { downloads: 3000000, updated: 1700000000000 },
      "some-plugin": { downloads: 5, updated: 1600000000000 },
    });
  });

  it("defaults missing numbers to 0 and tolerates junk values", () => {
    const raw = { weird: { downloads: "many" }, alsoWeird: null };
    expect(slimStats(raw)).toEqual({ weird: { downloads: 0, updated: 0 } });
  });

  it("returns empty object for non-object input", () => {
    expect(slimStats(null)).toEqual({});
    expect(slimStats([1, 2])).toEqual({});
  });
});

describe("mergeRegistry", () => {
  it("merges stats and categories into entries", () => {
    const stats = { dataview: { downloads: 3000000, updated: 1700000000000 } };
    const classify = () => ["Data & Queries"];
    expect(mergeRegistry([validEntry], stats, classify)).toEqual([
      { ...validEntry, downloads: 3000000, updated: 1700000000000, categories: ["Data & Queries"] },
    ]);
  });

  it("uses zeros when a plugin has no stats", () => {
    const [entry] = mergeRegistry([validEntry], {}, () => ["Other"]);
    expect(entry.downloads).toBe(0);
    expect(entry.updated).toBe(0);
  });
});
