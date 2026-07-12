import { PluginSettingTab, type App, type Setting, type SettingDefinitionItem } from "obsidian";
import type { SortKey } from "./data/filter";
import type BetterStorePlugin from "./main";

/** UI state persisted in plugin data (not shown in the settings tab). */
export interface UiState {
  layout: "grid" | "tree";
  detailWidth: number;
  treeExpanded: Record<string, string[]>;
}

export interface BetterStoreSettings {
  githubToken: string;
  cacheTtlHours: number;
  defaultSort: SortKey;
  hideInstalledByDefault: boolean;
  ignoredPlugins: string[];
  ignoredAuthors: string[];
  ignoredCategories: string[];
  favoritePlugins: string[];
  showNewBadges: boolean;
  backgroundUpdateCheck: boolean;
  updateNotice: boolean;
  ui: UiState;
}

export const DEFAULT_SETTINGS: BetterStoreSettings = {
  githubToken: "",
  cacheTtlHours: 12,
  defaultSort: "downloads",
  hideInstalledByDefault: false,
  ignoredPlugins: [],
  ignoredAuthors: [],
  ignoredCategories: [],
  favoritePlugins: [],
  showNewBadges: true,
  backgroundUpdateCheck: true,
  updateNotice: true,
  ui: { layout: "grid", detailWidth: 380, treeExpanded: {} },
};

/** How recent a plugin's registry debut must be to earn the "New" badge. */
export const NEW_WINDOW_DAYS = 14;

type ListKey = "favoritePlugins" | "ignoredPlugins" | "ignoredAuthors" | "ignoredCategories";

export class BetterStoreSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: BetterStorePlugin) {
    super(app, plugin);
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as keyof BetterStoreSettings];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    await this.plugin.saveSettings();
  }

  private removableList(heading: string, emptyState: string, key: ListKey): SettingDefinitionItem {
    return {
      type: "list",
      heading,
      emptyState,
      items: this.plugin.settings[key].map((name) => ({ name })),
      onDelete: (index) => {
        const next = [...this.plugin.settings[key]];
        next.splice(index, 1);
        this.plugin.settings[key] = next;
        void this.plugin.saveSettings();
        this.update();
      },
    };
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "GitHub token",
        desc: "Optional. Raises the GitHub API rate limit (60/hour without a token) used for stars, issues, and release data. A classic token with no scopes is enough.",
        render: (setting: Setting) => {
          setting.addText((text) => {
            text.inputEl.type = "password";
            text
              .setPlaceholder("ghp_...")
              .setValue(this.plugin.settings.githubToken)
              .onChange(async (value) => {
                this.plugin.settings.githubToken = value.trim();
                await this.plugin.saveSettings();
              });
          });
        },
      },
      {
        name: "Cache lifetime (hours)",
        desc: "How long the plugin catalog is cached before refetching. Use the refresh button in the store for an immediate update.",
        control: { type: "slider", key: "cacheTtlHours", min: 1, max: 72, step: 1, defaultValue: 12 },
      },
      {
        name: "Default sort",
        control: {
          type: "dropdown",
          key: "defaultSort",
          options: { downloads: "Downloads", updated: "Recently updated", name: "Name", trending: "Trending" },
          defaultValue: "downloads",
        },
      },
      {
        name: "Hide installed plugins by default",
        control: { type: "toggle", key: "hideInstalledByDefault", defaultValue: false },
      },
      {
        name: `Show "New" badges`,
        desc: `Highlight plugins that entered the registry within the last ${NEW_WINDOW_DAYS} days.`,
        control: { type: "toggle", key: "showNewBadges", defaultValue: true },
      },
      {
        type: "group",
        heading: "Updates",
        items: [
          {
            name: "Check for updates in the background",
            desc: "Checks your installed plugins against their repositories on the cache-lifetime cadence and marks the ribbon icon when updates are available.",
            control: { type: "toggle", key: "backgroundUpdateCheck", defaultValue: true },
          },
          {
            name: "Notify when updates are found",
            desc: "Shows a notice when the background check finds plugin updates.",
            control: { type: "toggle", key: "updateNotice", defaultValue: true },
          },
        ],
      },
      this.removableList(
        "Starred plugins",
        "No starred plugins. Use the star action on a plugin card or detail view.",
        "favoritePlugins"
      ),
      this.removableList(
        "Ignored plugins",
        "No ignored plugins. Use the ignore menu on a plugin card to hide it from browsing.",
        "ignoredPlugins"
      ),
      this.removableList(
        "Ignored authors",
        "No ignored authors. Use a plugin card's ignore menu to hide everything by an author.",
        "ignoredAuthors"
      ),
      this.removableList(
        "Ignored categories",
        "No ignored categories. Use a plugin card's ignore menu to hide a whole category.",
        "ignoredCategories"
      ),
    ];
  }
}
