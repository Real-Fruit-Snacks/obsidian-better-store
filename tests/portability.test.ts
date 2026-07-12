import { describe, it, expect } from "vitest";
import { buildExportList, exportJson, exportMarkdown, parseImport, diffImport } from "../src/data/portability";

const manifests = {
  tasks: { id: "tasks", name: "Tasks", version: "5.0.0" },
  git: { id: "git", name: "Git", version: "2.38.0" },
};

describe("buildExportList", () => {
  it("builds a name-sorted list with enabled state", () => {
    const list = buildExportList(manifests, new Set(["tasks"]));
    expect(list).toEqual([
      { id: "git", name: "Git", version: "2.38.0", enabled: false },
      { id: "tasks", name: "Tasks", version: "5.0.0", enabled: true },
    ]);
  });
});

describe("export/import round trips", () => {
  const list = buildExportList(manifests, new Set(["tasks"]));

  it("JSON export parses back to the same ids", () => {
    expect(parseImport(exportJson(list))).toEqual(["git", "tasks"]);
  });

  it("Markdown export contains a table and parses back to the same ids", () => {
    const md = exportMarkdown(list, "2026-07-12");
    expect(md).toContain("| Git | `git` | 2.38.0 | No |");
    expect(md).toContain("| Tasks | `tasks` | 5.0.0 | Yes |");
    expect(parseImport(md)).toEqual(["git", "tasks"]);
  });

  it("parses a bare JSON array of ids", () => {
    expect(parseImport('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns empty for unparseable input", () => {
    expect(parseImport("no ids here at all")).toEqual([]);
  });
});

describe("diffImport", () => {
  it("splits imported ids into present and missing", () => {
    const diff = diffImport(["tasks", "unknown-plugin"], new Set(["tasks", "git"]));
    expect(diff.present).toEqual(["tasks"]);
    expect(diff.missing).toEqual(["unknown-plugin"]);
  });
});
