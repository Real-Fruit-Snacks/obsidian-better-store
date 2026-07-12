import { describe, it, expect } from "vitest";
import { updateKnownIds, newIdsWithin } from "../src/data/newness";

const DAY = 86_400_000;
const NOW = 1_750_000_000_000;

describe("updateKnownIds", () => {
  it("baselines the first run so nothing counts as new", () => {
    const known = updateKnownIds(null, ["a", "b"], NOW);
    expect(newIdsWithin(known, 14, NOW).size).toBe(0);
  });

  it("stamps ids that appear after the baseline", () => {
    let known = updateKnownIds(null, ["a"], NOW - 30 * DAY);
    known = updateKnownIds(known, ["a", "b"], NOW - 5 * DAY);
    expect(known.firstSeen.b).toBe(NOW - 5 * DAY);
    expect(known.firstSeen.a).toBe(0);
  });

  it("never re-stamps an already-known id", () => {
    let known = updateKnownIds(null, ["a"], NOW - 30 * DAY);
    known = updateKnownIds(known, ["a", "b"], NOW - 20 * DAY);
    known = updateKnownIds(known, ["a", "b"], NOW);
    expect(known.firstSeen.b).toBe(NOW - 20 * DAY);
  });
});

describe("newIdsWithin", () => {
  it("returns ids first seen inside the window, excluding baseline entries", () => {
    let known = updateKnownIds(null, ["old"], NOW - 100 * DAY);
    known = updateKnownIds(known, ["old", "recent"], NOW - 5 * DAY);
    known = updateKnownIds(known, ["old", "recent", "ancient"], NOW - 5 * DAY);
    // simulate an id that was stamped long ago
    known = { ...known, firstSeen: { ...known.firstSeen, ancient: NOW - 60 * DAY } };
    const fresh = newIdsWithin(known, 14, NOW);
    expect(fresh.has("recent")).toBe(true);
    expect(fresh.has("ancient")).toBe(false);
    expect(fresh.has("old")).toBe(false);
  });
});
