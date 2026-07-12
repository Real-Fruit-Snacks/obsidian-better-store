import type { PluginEntry } from "./types";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "your", "from", "that", "this", "into",
  "obsidian", "plugin", "plugins", "note", "notes", "vault", "files", "file",
]);

function tokens(entry: PluginEntry): Set<string> {
  return new Set(
    `${entry.name} ${entry.description}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  );
}

/** Related plugins by shared categories (weighted heavily) plus keyword
 * overlap in names/descriptions; download count breaks ties. Only plugins
 * with an actual overlap qualify. */
export function similarPlugins(target: PluginEntry, all: PluginEntry[], limit = 5): PluginEntry[] {
  const targetTokens = tokens(target);
  const targetCats = new Set(target.categories.filter((c) => c !== "Other"));

  return all
    .filter((e) => e.id !== target.id)
    .map((e) => {
      const sharedCats = e.categories.filter((c) => targetCats.has(c)).length;
      let sharedTokens = 0;
      for (const t of tokens(e)) if (targetTokens.has(t)) sharedTokens++;
      return { entry: e, score: sharedCats * 3 + Math.min(sharedTokens, 5) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.downloads - a.entry.downloads)
    .slice(0, limit)
    .map((s) => s.entry);
}
