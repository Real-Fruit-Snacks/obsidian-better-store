import { describe, it, expect, vi } from "vitest";
import type { App } from "obsidian";
import { getPluginsApi, runCommand, getBratStatus, getInstalledIds } from "../src/ui/store-context";
import { BRAT_PLUGIN_ID } from "../src/data/brat";

function appWith(plugins: unknown, commands?: unknown): App {
  return { plugins, commands } as unknown as App;
}

const validPlugins = () => ({
  manifests: { dataview: { id: "dataview", name: "Dataview", version: "1.0.0" } },
  enabledPlugins: new Set(["dataview"]),
  enablePluginAndSave: async () => {},
  disablePluginAndSave: async () => {},
});

describe("getPluginsApi", () => {
  it("returns the real API when the shape is valid", () => {
    const plugins = validPlugins();
    expect(getPluginsApi(appWith(plugins))).toBe(plugins);
  });

  it("degrades to a safe empty API when app.plugins is missing", async () => {
    const api = getPluginsApi(appWith(undefined));
    expect(api.manifests).toEqual({});
    expect(api.enabledPlugins.size).toBe(0);
    // no-op methods resolve rather than throw
    await expect(api.enablePluginAndSave("x")).resolves.toBeUndefined();
  });

  it("degrades when the API is the wrong shape (e.g. enabledPlugins not a Set)", () => {
    const api = getPluginsApi(appWith({ manifests: {}, enabledPlugins: ["a"] }));
    expect(api.enabledPlugins instanceof Set).toBe(true);
    expect(api.enabledPlugins.size).toBe(0);
  });

  it("getInstalledIds reads ids from the API", () => {
    expect([...getInstalledIds(appWith(validPlugins()))]).toEqual(["dataview"]);
  });
});

describe("runCommand", () => {
  it("executes a command when the API is present and returns its result", () => {
    const executeCommandById = vi.fn(() => true);
    expect(runCommand(appWith(validPlugins(), { executeCommandById }), "a:b")).toBe(true);
    expect(executeCommandById).toHaveBeenCalledWith("a:b");
  });

  it("returns false without throwing when the command API is missing", () => {
    expect(runCommand(appWith(validPlugins(), undefined), "a:b")).toBe(false);
  });
});

describe("getBratStatus", () => {
  it("reports installed and enabled from the manifests/enabledPlugins", () => {
    const plugins = {
      manifests: { [BRAT_PLUGIN_ID]: { id: BRAT_PLUGIN_ID, name: "BRAT", version: "1.0.0" } },
      enabledPlugins: new Set([BRAT_PLUGIN_ID]),
      enablePluginAndSave: async () => {},
      disablePluginAndSave: async () => {},
    };
    expect(getBratStatus(appWith(plugins))).toEqual({ installed: true, enabled: true });
  });

  it("reports installed-but-disabled and not-installed", () => {
    const installedDisabled = {
      manifests: { [BRAT_PLUGIN_ID]: { id: BRAT_PLUGIN_ID, name: "BRAT", version: "1.0.0" } },
      enabledPlugins: new Set<string>(),
      enablePluginAndSave: async () => {},
      disablePluginAndSave: async () => {},
    };
    expect(getBratStatus(appWith(installedDisabled))).toEqual({ installed: true, enabled: false });
    expect(getBratStatus(appWith(validPlugins()))).toEqual({ installed: false, enabled: false });
  });
});
