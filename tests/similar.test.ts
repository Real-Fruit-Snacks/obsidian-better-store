import { describe, it, expect } from "vitest";
import { similarPlugins } from "../src/data/similar";
import type { PluginEntry } from "../src/data/types";

function entry(overrides: Partial<PluginEntry>): PluginEntry {
  return {
    id: "x", name: "X", author: "A", description: "", repo: "a/x",
    downloads: 0, updated: 0, categories: ["Other"],
    ...overrides,
  };
}

const target = entry({
  id: "tasks",
  name: "Tasks",
  description: "Track tasks and checklists across your vault",
  categories: ["Tasks"],
});

const all: PluginEntry[] = [
  target,
  entry({ id: "kanban", name: "Kanban", description: "kanban board for tasks", categories: ["Tasks"], downloads: 100 }),
  entry({ id: "todo", name: "Checklist", description: "checklists everywhere", categories: ["Tasks"], downloads: 50 }),
  entry({ id: "theme", name: "Theme Tool", description: "colors and styling", categories: ["Appearance"], downloads: 9999 }),
  entry({ id: "unrelated", name: "Zeta", description: "frobnicates quuxes", categories: ["Other"] }),
];

describe("similarPlugins", () => {
  it("ranks shared-category plugins first and excludes the target itself", () => {
    const got = similarPlugins(target, all, 5);
    expect(got.map((e) => e.id)).not.toContain("tasks");
    expect(got[0].id).toBe("kanban");
    expect(got.map((e) => e.id)).toContain("todo");
  });

  it("excludes plugins with no overlap at all", () => {
    const got = similarPlugins(target, all, 5);
    expect(got.map((e) => e.id)).not.toContain("unrelated");
  });

  it("respects the limit", () => {
    expect(similarPlugins(target, all, 1)).toHaveLength(1);
  });
});
