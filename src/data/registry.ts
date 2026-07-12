import type { PluginEntry, RegistryPlugin } from "./types";

function isRegistryPlugin(v: unknown): v is RegistryPlugin {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.author === "string" &&
    typeof o.description === "string" &&
    typeof o.repo === "string"
  );
}

export function parseRegistry(raw: unknown): RegistryPlugin[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRegistryPlugin).map((p) => ({
    id: p.id,
    name: p.name,
    author: p.author,
    description: p.description,
    repo: p.repo,
  }));
}

export function slimStats(raw: unknown): Record<string, { downloads: number; updated: number }> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, { downloads: number; updated: number }> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    out[id] = {
      downloads: typeof o.downloads === "number" ? o.downloads : 0,
      updated: typeof o.updated === "number" ? o.updated : 0,
    };
  }
  return out;
}

export function mergeRegistry(
  plugins: RegistryPlugin[],
  stats: Record<string, { downloads: number; updated: number }>,
  classify: (name: string, description: string) => string[]
): PluginEntry[] {
  return plugins.map((p) => ({
    ...p,
    downloads: stats[p.id]?.downloads ?? 0,
    updated: stats[p.id]?.updated ?? 0,
    categories: classify(p.name, p.description),
  }));
}
