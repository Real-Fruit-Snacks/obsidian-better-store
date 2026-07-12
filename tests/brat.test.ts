import { describe, it, expect } from "vitest";
import { parseBratPlugins, BRAT_COMMANDS, BRAT_PLUGIN_ID } from "../src/data/brat";

describe("parseBratPlugins", () => {
  it("returns [] for missing or malformed data", () => {
    expect(parseBratPlugins(null)).toEqual([]);
    expect(parseBratPlugins("nope")).toEqual([]);
    expect(parseBratPlugins({})).toEqual([]);
  });

  it("reads the plain plugin list as latest-tracking repos", () => {
    expect(parseBratPlugins({ pluginList: ["owner/a", "owner/b"] })).toEqual([
      { repo: "owner/a", frozenVersion: null },
      { repo: "owner/b", frozenVersion: null },
    ]);
  });

  it("reads frozen versions, treating 'latest' as not pinned", () => {
    const got = parseBratPlugins({
      pluginSubListFrozenVersion: [
        { repo: "owner/c", version: "1.2.3" },
        { repo: "owner/d", version: "latest" },
      ],
    });
    expect(got).toEqual([
      { repo: "owner/c", frozenVersion: "1.2.3" },
      { repo: "owner/d", frozenVersion: null },
    ]);
  });

  it("merges both lists and lets a frozen entry win, sorted by repo", () => {
    const got = parseBratPlugins({
      pluginList: ["owner/z", "owner/a"],
      pluginSubListFrozenVersion: [{ repo: "owner/a", version: "2.0.0" }],
    });
    expect(got).toEqual([
      { repo: "owner/a", frozenVersion: "2.0.0" },
      { repo: "owner/z", frozenVersion: null },
    ]);
  });

  it("skips malformed entries", () => {
    const got = parseBratPlugins({
      pluginList: ["ok/repo", "", 42, null],
      pluginSubListFrozenVersion: [{ version: "1.0.0" }, "bad", { repo: "good/one", version: "1.0.0" }],
    });
    expect(got.map((p) => p.repo).sort()).toEqual(["good/one", "ok/repo"]);
  });

  it("exposes the expected BRAT command ids", () => {
    expect(BRAT_COMMANDS.addBetaPlugin).toBe(`${BRAT_PLUGIN_ID}:AddBetaPlugin`);
    expect(BRAT_COMMANDS.checkAndUpdate).toBe(`${BRAT_PLUGIN_ID}:checkForUpdatesAndUpdate`);
  });
});
