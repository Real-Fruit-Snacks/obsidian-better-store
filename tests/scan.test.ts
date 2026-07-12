import { describe, it, expect } from "vitest";
import { pendingRepos, scanCoverage, type RepoStats } from "../src/data/scan";

const HOUR = 3_600_000;
const NOW = 1_000_000_000;

const stat = (scannedAt: number): RepoStats => ({ stars: 1, openIssues: 0, createdAt: 0, scannedAt });

describe("pendingRepos", () => {
  it("returns every repo when nothing is cached", () => {
    expect(pendingRepos(["a/1", "a/2"], {}, NOW, 24 * HOUR)).toEqual(["a/1", "a/2"]);
  });

  it("skips repos scanned within the freshness window", () => {
    const cache = { "a/1": stat(NOW - HOUR) };
    expect(pendingRepos(["a/1", "a/2"], cache, NOW, 24 * HOUR)).toEqual(["a/2"]);
  });

  it("includes repos scanned longer ago than maxAge", () => {
    const cache = { "a/1": stat(NOW - 48 * HOUR) };
    expect(pendingRepos(["a/1"], cache, NOW, 24 * HOUR)).toEqual(["a/1"]);
  });

  it("orders never-scanned first, then stalest-scanned", () => {
    const cache = { "a/2": stat(NOW - 100 * HOUR), "a/3": stat(NOW - 50 * HOUR) };
    // a/1 never scanned → first; then a/2 (older) before a/3.
    expect(pendingRepos(["a/3", "a/2", "a/1"], cache, NOW, 24 * HOUR)).toEqual(["a/1", "a/2", "a/3"]);
  });

  it("deduplicates repeated repos", () => {
    expect(pendingRepos(["a/1", "a/1"], {}, NOW, HOUR)).toEqual(["a/1"]);
  });
});

describe("scanCoverage", () => {
  it("counts distinct scanned repos against the catalog total", () => {
    const cache = { "a/1": stat(NOW), "a/9": stat(NOW) }; // a/9 not in the catalog
    expect(scanCoverage(["a/1", "a/2", "a/2", "a/3"], cache)).toEqual({ scanned: 1, total: 3 });
  });
});
