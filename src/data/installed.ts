import type { PluginEntry } from "./types";
import { compareVersions } from "./versions";

const ABANDONED_MS = 365 * 86_400_000;

export interface InstalledInfo {
  id: string;
  name: string;
  version: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  enabled: boolean;
  repo: string | null;
  updated: number | null;
  abandoned: boolean;
}

export function buildInstalledInfo(
  manifests: Record<string, { id: string; name: string; version: string }>,
  enabledIds: Set<string>,
  catalog: PluginEntry[],
  latestVersions: Record<string, string | null>,
  now: number
): InstalledInfo[] {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  return Object.values(manifests)
    .map((m) => {
      const entry = byId.get(m.id);
      const latest = latestVersions[m.id] ?? null;
      return {
        id: m.id,
        name: m.name,
        version: m.version,
        latestVersion: latest,
        updateAvailable: latest != null && compareVersions(latest, m.version) > 0,
        enabled: enabledIds.has(m.id),
        repo: entry?.repo ?? null,
        updated: entry?.updated ?? null,
        abandoned: entry != null && entry.updated > 0 && now - entry.updated > ABANDONED_MS,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
