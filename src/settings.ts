import { PluginSettingTab, SecretComponent, type App, type Setting, type SettingDefinitionItem } from "obsidian";
import type { FilterState, SortKey } from "./data/filter";
import type { PluginProfile } from "./data/profiles";
import type BetterStorePlugin from "./main";
import { ImportModal } from "./ui/modals";

/** UI state persisted in plugin data (not shown in the settings tab). */
export interface UiState {
  layout: "grid" | "tree";
  detailWidth: number;
  treeExpanded: Record<string, string[]>;
  recentlyViewed: string[];
}

export interface FilterPreset {
  name: string;
  state: FilterState;
}

export interface BetterStoreSettings {
  /** Name of the secret (in Obsidian's secret storage) holding the GitHub token. */
  githubSecretId: string;
  cacheTtlHours: number;
  defaultSort: SortKey;
  openLocation: "tab" | "split" | "window";
  hideInstalledByDefault: boolean;
  ignoredPlugins: string[];
  ignoredAuthors: string[];
  ignoredCategories: string[];
  favoritePlugins: string[];
  showNewBadges: boolean;
  showCardStars: boolean;
  backgroundUpdateCheck: boolean;
  updateNotice: boolean;
  showHealth: boolean;
  showSimilar: boolean;
  showSparkline: boolean;
  trackRecentlyViewed: boolean;
  profiles: PluginProfile[];
  filterPresets: FilterPreset[];
  ui: UiState;
}

export const DEFAULT_SETTINGS: BetterStoreSettings = {
  githubSecretId: "",
  cacheTtlHours: 12,
  defaultSort: "downloads",
  openLocation: "tab",
  hideInstalledByDefault: false,
  ignoredPlugins: [],
  ignoredAuthors: [],
  ignoredCategories: [],
  favoritePlugins: [],
  showNewBadges: true,
  showCardStars: true,
  backgroundUpdateCheck: true,
  updateNotice: true,
  showHealth: true,
  showSimilar: true,
  showSparkline: true,
  trackRecentlyViewed: true,
  profiles: [],
  filterPresets: [],
  ui: { layout: "grid", detailWidth: 380, treeExpanded: {}, recentlyViewed: [] },
};

/** How recent a plugin's registry debut must be to earn the "New" badge. */
export const NEW_WINDOW_DAYS = 14;

type StringListKey = "favoritePlugins" | "ignoredPlugins" | "ignoredAuthors" | "ignoredCategories";

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

  private removableList(heading: string, emptyState: string, key: StringListKey): SettingDefinitionItem {
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
        desc: "Optional. Link a secret holding a GitHub personal access token — it raises the API rate limit (60/hour without) used for stars, issues, and release data. A classic token with no scopes is enough. Only the secret's name is stored in plugin data; the token stays in Obsidian's secret storage.",
        render: (setting: Setting) => {
          setting.addComponent((el) => {
            const secret = new SecretComponent(this.app, el);
            // The component links a named secret: its value is the secret's
            // name, not the token itself (null when nothing is linked).
            secret.setValue(this.plugin.settings.githubSecretId);
            secret.onChange((id) => {
              void (async () => {
                const next = (id ?? "").trim();
                await this.plugin.setGithubSecretId(next);
                // Verify right away so a bad link surfaces now, not days
                // later — and put a good token straight to work.
                if (next && (await this.plugin.testGithubToken())) this.plugin.onTokenLinked();
              })();
            });
            return secret;
          });
          setting.addButton((btn) =>
            btn
              .setButtonText("Test")
              .setTooltip("Verify the linked token against the GitHub API")
              .onClick(async () => {
                btn.setDisabled(true).setButtonText("Testing…");
                try {
                  await this.plugin.testGithubToken();
                } finally {
                  btn.setDisabled(false).setButtonText("Test");
                }
              })
          );
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
        name: "Open the store in",
        desc: "Where the store opens from the ribbon and commands. A new window is desktop-only and falls back to a tab on mobile.",
        control: {
          type: "dropdown",
          key: "openLocation",
          options: { tab: "A tab", split: "A split", window: "A new window" },
          defaultValue: "tab",
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
        name: "Show GitHub stars on cards",
        desc: "With a token linked, fetches star counts for the cards on screen (one API request per plugin, cached for the session). Without a token this stays inactive so the anonymous rate limit is saved for the detail pane.",
        control: { type: "toggle", key: "showCardStars", defaultValue: true },
      },
      {
        name: "Track recently viewed plugins",
        desc: "Ranks plugins you've opened recently at the top of the quick-jump search.",
        control: { type: "toggle", key: "trackRecentlyViewed", defaultValue: true },
      },
      {
        type: "group",
        heading: "Detail pane",
        items: [
          {
            name: "Show maintenance health",
            desc: "A healthy / aging / at-risk chip based on update recency and release cadence.",
            control: { type: "toggle", key: "showHealth", defaultValue: true },
          },
          {
            name: "Show similar plugins",
            desc: "Related plugins by shared categories and keywords.",
            control: { type: "toggle", key: "showSimilar", defaultValue: true },
          },
          {
            name: "Show download history chart",
            desc: "A small sparkline built from your catalog-refresh snapshots.",
            control: { type: "toggle", key: "showSparkline", defaultValue: true },
          },
        ],
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
      {
        type: "group",
        heading: "Portability",
        items: [
          {
            name: "Export plugin list (Markdown)",
            desc: "Copies a Markdown table of your installed plugins to the clipboard.",
            action: () => void this.plugin.exportPluginList("markdown"),
          },
          {
            name: "Export plugin list (JSON)",
            desc: "Copies a JSON export of your installed plugins to the clipboard.",
            action: () => void this.plugin.exportPluginList("json"),
          },
          {
            name: "Import plugin list…",
            desc: "Paste an exported list to see what's missing from this vault.",
            action: () => new ImportModal(this.app, this.plugin).open(),
          },
        ],
      },
      {
        type: "list",
        heading: "Profiles",
        emptyState: "No profiles. Save one from Better Store's Installed tab.",
        items: this.plugin.settings.profiles.map((p) => ({
          name: p.name,
          desc: `${p.pluginIds.length} plugins`,
        })),
        onDelete: (index) => {
          const next = [...this.plugin.settings.profiles];
          next.splice(index, 1);
          this.plugin.settings.profiles = next;
          void this.plugin.saveSettings();
          this.update();
        },
      },
      {
        type: "list",
        heading: "Filter presets",
        emptyState: "No presets. Save one from the browse sidebar.",
        items: this.plugin.settings.filterPresets.map((p) => ({ name: p.name })),
        onDelete: (index) => {
          const next = [...this.plugin.settings.filterPresets];
          next.splice(index, 1);
          this.plugin.settings.filterPresets = next;
          void this.plugin.saveSettings();
          this.update();
        },
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
