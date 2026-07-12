import { describe, it, expect } from "vitest";
import { diffProfile } from "../src/data/profiles";

describe("diffProfile", () => {
  const installed = new Set(["a", "b", "c", "self"]);

  it("computes enables, disables, and missing plugins", () => {
    const diff = diffProfile(["a", "b", "x"], new Set(["b", "c", "self"]), installed, "self");
    expect(diff.toEnable).toEqual(["a"]);
    expect(diff.toDisable).toEqual(["c"]);
    expect(diff.missing).toEqual(["x"]);
  });

  it("never touches the plugin itself", () => {
    const diff = diffProfile(["a"], new Set(["self"]), installed, "self");
    expect(diff.toDisable).not.toContain("self");
    const diff2 = diffProfile(["self", "a"], new Set([]), installed, "self");
    expect(diff2.toEnable).not.toContain("self");
  });

  it("is a no-op when the profile matches the current state", () => {
    const diff = diffProfile(["a", "b"], new Set(["a", "b", "self"]), installed, "self");
    expect(diff.toEnable).toEqual([]);
    expect(diff.toDisable).toEqual([]);
    expect(diff.missing).toEqual([]);
  });
});
