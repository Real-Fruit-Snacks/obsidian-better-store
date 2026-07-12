import { describe, it, expect } from "vitest";
import { assessHealth } from "../src/data/health";

const DAY = 86_400_000;
const NOW = 1_750_000_000_000;

function releases(count: number, daysAgo = 30): { publishedAt: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    publishedAt: new Date(NOW - (daysAgo + i * 10) * DAY).toISOString(),
  }));
}

describe("assessHealth", () => {
  it("recently updated plugins are healthy", () => {
    const h = assessHealth({ updated: NOW - 30 * DAY, releases: releases(2), now: NOW });
    expect(h.level).toBe("healthy");
    expect(h.reasons.length).toBeGreaterThan(0);
  });

  it("plugins untouched for 4-12 months are aging", () => {
    const h = assessHealth({ updated: NOW - 200 * DAY, releases: [], now: NOW });
    expect(h.level).toBe("aging");
  });

  it("an active release cadence lifts an aging plugin back to healthy", () => {
    const h = assessHealth({ updated: NOW - 200 * DAY, releases: releases(4, 40), now: NOW });
    expect(h.level).toBe("healthy");
  });

  it("plugins untouched for over a year are at risk", () => {
    const h = assessHealth({ updated: NOW - 400 * DAY, releases: [], now: NOW });
    expect(h.level).toBe("at-risk");
  });

  it("unknown update dates read as aging, not at-risk", () => {
    const h = assessHealth({ updated: 0, releases: [], now: NOW });
    expect(h.level).toBe("aging");
  });
});
