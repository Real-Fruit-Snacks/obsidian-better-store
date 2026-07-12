import type { App } from "obsidian";

export type TabId = "all" | "updated" | "trending" | "installed";

interface PluginsApi {
  manifests: Record<string, unknown>;
}

/** Installed community plugin ids. Uses the internal `app.plugins` API (untyped). */
export function getInstalledIds(app: App): Set<string> {
  const plugins = (app as unknown as { plugins?: PluginsApi }).plugins;
  return new Set(Object.keys(plugins?.manifests ?? {}));
}
