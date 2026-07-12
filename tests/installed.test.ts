import { describe, it, expect } from "vitest";
import { buildInstalledInfo } from "../src/data/installed";
import type { PluginEntry } from "../src/data/types";

const DAY = 86_400_000;
const NOW = 1_750_000_000_000;

const catalog: PluginEntry[] = [
  {
    id: "tasks", name: "Tasks", author: "A", description: "", repo: "org/tasks",
    downloads: 10, updated: NOW - 30 * DAY, categories: ["Tasks"],
  },
  {
    id: "old-one", name: "Old One", author: "B", description: "", repo: "org/old",
    downloads: 5, updated: NOW - 400 * DAY, categories: ["Other"],
  },
];

describe("buildInstalledInfo", () => {
  it("flags update availability via version compare", () => {
    const infos = buildInstalledInfo(
      { tasks: { id: "tasks", name: "Tasks", version: "1.0.0" } },
      new Set(["tasks"]),
      catalog,
      { tasks: "1.2.0" },
      NOW
    );
    expect(infos[0]).toMatchObject({
      id: "tasks", enabled: true, latestVersion: "1.2.0", updateAvailable: true,
      repo: "org/tasks", abandoned: false,
    });
  });

  it("flags abandoned plugins (no update in 12+ months) and handles unknown latest", () => {
    const infos = buildInstalledInfo(
      { "old-one": { id: "old-one", name: "Old One", version: "2.0.0" } },
      new Set(),
      catalog,
      {},
      NOW
    );
    expect(infos[0]).toMatchObject({
      enabled: false, latestVersion: null, updateAvailable: false, abandoned: true,
    });
  });

  it("handles plugins not in the catalog (e.g. BRAT installs) and sorts by name", () => {
    const infos = buildInstalledInfo(
      {
        zeta: { id: "zeta", name: "Zeta", version: "1.0.0" },
        tasks: { id: "tasks", name: "Tasks", version: "1.0.0" },
      },
      new Set(),
      catalog,
      {},
      NOW
    );
    expect(infos.map((i) => i.id)).toEqual(["tasks", "zeta"]);
    expect(infos[1]).toMatchObject({ repo: null, updated: null, abandoned: false });
  });
});
