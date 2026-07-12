/** BRAT (obsidian42-brat) integration constants and its data-file parsing. */

export const BRAT_PLUGIN_ID = "obsidian42-brat";

/** BRAT command ids (registered as `<pluginId>:<id>`). */
export const BRAT_COMMANDS = {
  addBetaPlugin: `${BRAT_PLUGIN_ID}:AddBetaPlugin`,
  checkAndUpdate: `${BRAT_PLUGIN_ID}:checkForUpdatesAndUpdate`,
  checkOnly: `${BRAT_PLUGIN_ID}:checkForUpdatesAndDontUpdate`,
} as const;

export interface BratBetaPlugin {
  /** GitHub "owner/repo" path BRAT tracks. */
  repo: string;
  /** Pinned version when the user froze one; null means "track latest". */
  frozenVersion: string | null;
}

interface BratDataShape {
  pluginList?: unknown;
  pluginSubListFrozenVersion?: unknown;
}

/**
 * Parse BRAT's `data.json` into a normalized beta-plugin list. Reads BRAT's
 * `pluginList` (repos tracking latest) plus `pluginSubListFrozenVersion`
 * (repos pinned to a tag). Defensive: any malformed shape yields [].
 */
export function parseBratPlugins(raw: unknown): BratBetaPlugin[] {
  if (raw == null || typeof raw !== "object") return [];
  const data = raw as BratDataShape;
  const byRepo = new Map<string, BratBetaPlugin>();

  if (Array.isArray(data.pluginList)) {
    for (const repo of data.pluginList) {
      if (typeof repo === "string" && repo.trim()) {
        byRepo.set(repo, { repo, frozenVersion: null });
      }
    }
  }

  if (Array.isArray(data.pluginSubListFrozenVersion)) {
    for (const item of data.pluginSubListFrozenVersion) {
      if (item == null || typeof item !== "object") continue;
      const { repo, version } = item as { repo?: unknown; version?: unknown };
      if (typeof repo !== "string" || !repo.trim()) continue;
      // "latest" is BRAT's sentinel for "not actually pinned".
      const frozenVersion = typeof version === "string" && version !== "latest" ? version : null;
      byRepo.set(repo, { repo, frozenVersion });
    }
  }

  return [...byRepo.values()].sort((a, b) => a.repo.localeCompare(b.repo));
}
