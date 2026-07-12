import { describe, it, expect } from "vitest";
import { formatCount, formatAge } from "../src/data/format";

const DAY = 86_400_000;
const NOW = 1_750_000_000_000;

describe("formatCount", () => {
  it("formats thousands and millions with one decimal, trimming .0", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(45300)).toBe("45.3k");
    expect(formatCount(1234567)).toBe("1.2M");
    expect(formatCount(3000000)).toBe("3M");
  });
});

describe("formatAge", () => {
  it("formats relative ages", () => {
    expect(formatAge(0, NOW)).toBe("unknown");
    expect(formatAge(NOW - 1000, NOW)).toBe("today");
    expect(formatAge(NOW - 5 * DAY, NOW)).toBe("5d ago");
    expect(formatAge(NOW - 95 * DAY, NOW)).toBe("3mo ago");
    expect(formatAge(NOW - 800 * DAY, NOW)).toBe("2y ago");
  });
});
