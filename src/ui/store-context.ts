import type { App } from "obsidian";
import { BRAT_PLUGIN_ID } from "../data/brat";

export type TabId = "all" | "updated" | "trending" | "installed";

/** Shape of Obsidian's internal (untyped) `app.plugins` API. Documented risk in the spec:
 * widely used by other plugins, but could change in an Obsidian update. */
export interface PluginsApi {
  manifests: Record<string, { id: string; name: string; version: string }>;
  enabledPlugins: Set<string>;
  enablePluginAndSave(id: string): Promise<void>;
  disablePluginAndSave(id: string): Promise<void>;
}

/** A no-op stand-in used when Obsidian's internal plugins API isn't the shape we expect. */
const EMPTY_PLUGINS_API: PluginsApi = {
  manifests: {},
  enabledPlugins: new Set(),
  enablePluginAndSave: async () => {},
  disablePluginAndSave: async () => {},
};

let warnedMissingPlugins = false;

/**
 * Access Obsidian's internal `app.plugins`. It is undocumented but widely used;
 * if a future Obsidian ever changes its shape, degrade to an empty API (so the
 * UI shows "nothing installed") instead of throwing during render.
 */
export function getPluginsApi(app: App): PluginsApi {
  const api = (app as unknown as { plugins?: Partial<PluginsApi> }).plugins;
  if (
    api == null ||
    typeof api.enablePluginAndSave !== "function" ||
    typeof api.disablePluginAndSave !== "function" ||
    api.manifests == null ||
    !(api.enabledPlugins instanceof Set)
  ) {
    if (!warnedMissingPlugins) {
      console.warn("Better Store: Obsidian's internal plugins API was not the expected shape; installed-plugin features are disabled.");
      warnedMissingPlugins = true;
    }
    return EMPTY_PLUGINS_API;
  }
  return api as PluginsApi;
}

/** Installed community plugin ids. */
export function getInstalledIds(app: App): Set<string> {
  return new Set(Object.keys(getPluginsApi(app).manifests));
}

/** Whether BRAT is present, and whether it's currently enabled (its commands only exist when enabled). */
export function getBratStatus(app: App): { installed: boolean; enabled: boolean } {
  const api = getPluginsApi(app);
  return { installed: BRAT_PLUGIN_ID in api.manifests, enabled: api.enabledPlugins.has(BRAT_PLUGIN_ID) };
}

/** Run an Obsidian command by id (used to hand off to BRAT's own commands). */
export function runCommand(app: App, id: string): boolean {
  const commands = (app as unknown as { commands?: { executeCommandById?(id: string): boolean } }).commands;
  if (typeof commands?.executeCommandById !== "function") {
    console.warn(`Better Store: could not run command "${id}" — Obsidian's command API was unavailable.`);
    return false;
  }
  return commands.executeCommandById(id);
}
