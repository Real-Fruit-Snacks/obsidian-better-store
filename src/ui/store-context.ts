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

export function getPluginsApi(app: App): PluginsApi {
  return (app as unknown as { plugins: PluginsApi }).plugins;
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
export function runCommand(app: App, id: string): void {
  (app as unknown as { commands: { executeCommandById(id: string): boolean } }).commands.executeCommandById(id);
}
