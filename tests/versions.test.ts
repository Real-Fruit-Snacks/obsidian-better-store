import { describe, it, expect } from "vitest";
import { compareVersions } from "../src/data/versions";

describe("compareVersions", () => {
  it("orders numeric dotted versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2.3", "1.2.4")).toBeLessThan(0);
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("treats missing segments as 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("2", "1.9.9")).toBeGreaterThan(0);
  });

  it("tolerates non-numeric junk segments as 0", () => {
    expect(compareVersions("1.beta", "1.0")).toBe(0);
  });
});
