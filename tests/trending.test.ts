import { describe, it, expect } from "vitest";
import { appendSnapshot, computeDeltas, type Snapshot } from "../src/data/trending";

const HOUR = 3_600_000;

describe("appendSnapshot", () => {
  it("appends a snapshot to empty history", () => {
    const snap: Snapshot = { ts: 0, downloads: { a: 1 } };
    expect(appendSnapshot([], snap)).toEqual([snap]);
  });

  it("skips snapshots taken less than minIntervalMs after the last (returns same reference)", () => {
    const history: Snapshot[] = [{ ts: 0, downloads: { a: 1 } }];
    const result = appendSnapshot(history, { ts: 2 * HOUR, downloads: { a: 2 } });
    expect(result).toBe(history);
  });

  it("appends after the interval and caps history length", () => {
    let history: Snapshot[] = [];
    for (let i = 0; i < 40; i++) {
      history = appendSnapshot(history, { ts: i * 7 * HOUR, downloads: { a: i } });
    }
    expect(history.length).toBe(30);
    expect(history[history.length - 1].downloads.a).toBe(39);
    expect(history[0].downloads.a).toBe(10);
  });
});

describe("computeDeltas", () => {
  it("returns empty object with fewer than 2 snapshots", () => {
    expect(computeDeltas([])).toEqual({});
    expect(computeDeltas([{ ts: 0, downloads: { a: 5 } }])).toEqual({});
  });

  it("computes newest minus oldest per plugin, skipping plugins absent from the oldest", () => {
    const history: Snapshot[] = [
      { ts: 0, downloads: { a: 100, b: 50 } },
      { ts: 7 * HOUR, downloads: { a: 110, b: 50 } },
      { ts: 14 * HOUR, downloads: { a: 150, b: 60, brandNew: 999 } },
    ];
    expect(computeDeltas(history)).toEqual({ a: 50, b: 10 });
  });
});
