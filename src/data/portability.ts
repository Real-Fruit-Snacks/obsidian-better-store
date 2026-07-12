/** Export/import of the installed-plugin list for backup and sharing. */
export interface ExportedPlugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}

export function buildExportList(
  manifests: Record<string, { id: string; name: string; version: string }>,
  enabledIds: Set<string>
): ExportedPlugin[] {
  return Object.values(manifests)
    .map((m) => ({ id: m.id, name: m.name, version: m.version, enabled: enabledIds.has(m.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function exportJson(list: ExportedPlugin[]): string {
  return JSON.stringify({ type: "better-store-plugin-list", plugins: list }, null, 2);
}

export function exportMarkdown(list: ExportedPlugin[], date: string): string {
  const rows = list.map((p) => `| ${p.name} | \`${p.id}\` | ${p.version} | ${p.enabled ? "Yes" : "No"} |`);
  return [
    `# Obsidian plugins — exported ${date}`,
    "",
    "| Plugin | ID | Version | Enabled |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** Accepts our JSON export, a bare JSON array of ids, or a Markdown table
 * with backticked ids. Returns the plugin ids found (deduplicated, in order). */
export function parseImport(text: string): string[] {
  const seen = new Set<string>();
  const push = (id: unknown) => {
    if (typeof id === "string" && id.trim()) seen.add(id.trim());
  };

  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      for (const item of parsed) push(typeof item === "object" && item !== null ? (item as { id?: unknown }).id : item);
    } else if (typeof parsed === "object" && parsed !== null) {
      const plugins = (parsed as { plugins?: unknown }).plugins;
      if (Array.isArray(plugins)) for (const item of plugins) push((item as { id?: unknown }).id);
    }
    return [...seen];
  } catch {
    // Not JSON — scan for backticked ids (our Markdown table format).
    for (const match of text.matchAll(/`([A-Za-z0-9._-]+)`/g)) push(match[1]);
    return [...seen];
  }
}

export function diffImport(imported: string[], installed: Set<string>): { present: string[]; missing: string[] } {
  return {
    present: imported.filter((id) => installed.has(id)),
    missing: imported.filter((id) => !installed.has(id)),
  };
}
