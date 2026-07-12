import type { App } from "obsidian";

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
