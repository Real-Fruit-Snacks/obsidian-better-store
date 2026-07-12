import { describe, it, expect } from "vitest";
import { classifyPlugin, ALL_CATEGORIES } from "../src/data/categories";

describe("classifyPlugin", () => {
  it("matches keywords case-insensitively with word boundaries", () => {
    expect(classifyPlugin("Tasks", "Track TODO items in your vault")).toContain("Tasks");
    expect(classifyPlugin("Kanban", "A kanban board")).toContain("Tasks");
  });

  it("does not match keyword fragments inside words", () => {
    // "maintain" contains "ai" but must not classify as AI
    const cats = classifyPlugin("Maintainer Tools", "Helps maintain your notes");
    expect(cats).not.toContain("AI");
  });

  it("can assign multiple categories", () => {
    const cats = classifyPlugin("Calendar Sync", "Sync your calendar events");
    expect(cats).toContain("Calendar & Time");
    expect(cats).toContain("Sync & Backup");
  });

  it("falls back to Other when nothing matches", () => {
    expect(classifyPlugin("Zzyzx", "Frobnicates the quux")).toEqual(["Other"]);
  });

  it("every rule category appears in ALL_CATEGORIES, Other last", () => {
    const sample = classifyPlugin("AI Tasks Theme Export Calendar Dataview Git", "publish zotero file editor");
    for (const c of sample) expect(ALL_CATEGORIES).toContain(c);
    expect(ALL_CATEGORIES[ALL_CATEGORIES.length - 1]).toBe("Other");
  });
});
