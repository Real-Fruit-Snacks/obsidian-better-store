import { App, PluginSettingTab, Setting } from "obsidian";
import type { SortKey } from "./data/filter";
import type BetterStorePlugin from "./main";

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
};

/** How recent a plugin's registry debut must be to earn the "New" badge. */
export const NEW_WINDOW_DAYS = 14;

export class BetterStoreSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: BetterStorePlugin) {
    super(app, plugin);
  }

  private removableList(
    containerEl: HTMLElement,
    heading: string,
    emptyText: string,
    items: string[],
    remove: (item: string) => void
  ): void {
    new Setting(containerEl).setName(heading).setHeading();
    if (items.length === 0) {
      containerEl.createEl("p", { text: emptyText, cls: "setting-item-description" });
      return;
    }
    for (const item of [...items]) {
      new Setting(containerEl).setName(item).addExtraButton((btn) =>
        btn
          .setIcon("x")
          .setTooltip("Remove")
          .onClick(async () => {
            remove(item);
            await this.plugin.saveSettings();
            this.display();
          })
      );
    }
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("GitHub token")
      .setDesc(
        "Optional. Raises the GitHub API rate limit (60/hour without a token) used for stars, issues, and release data. A classic token with no scopes is enough."
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("ghp_...")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Cache lifetime (hours)")
      .setDesc("How long the plugin catalog is cached before refetching. Use the refresh button in the store for an immediate update.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 72, 1)
          .setValue(this.plugin.settings.cacheTtlHours)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.cacheTtlHours = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default sort")
      .addDropdown((dd) =>
        dd
          .addOptions({ downloads: "Downloads", updated: "Recently updated", name: "Name", trending: "Trending" })
          .setValue(this.plugin.settings.defaultSort)
          .onChange(async (value) => {
            this.plugin.settings.defaultSort = value as SortKey;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hide installed plugins by default")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.hideInstalledByDefault).onChange(async (value) => {
          this.plugin.settings.hideInstalledByDefault = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(`Show "New" badges`)
      .setDesc(`Highlight plugins that entered the registry within the last ${NEW_WINDOW_DAYS} days.`)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showNewBadges).onChange(async (value) => {
          this.plugin.settings.showNewBadges = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("Updates").setHeading();

    new Setting(containerEl)
      .setName("Check for updates in the background")
      .setDesc("Checks your installed plugins against their repositories on the cache-lifetime cadence and marks the ribbon icon when updates are available.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.backgroundUpdateCheck).onChange(async (value) => {
          this.plugin.settings.backgroundUpdateCheck = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Notify when updates are found")
      .setDesc("Shows a notice when the background check finds plugin updates.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.updateNotice).onChange(async (value) => {
          this.plugin.settings.updateNotice = value;
          await this.plugin.saveSettings();
        })
      );

    this.removableList(
      containerEl,
      "Starred plugins",
      "No starred plugins. Use the star action on a plugin card or detail view.",
      this.plugin.settings.favoritePlugins,
      (id) => {
        this.plugin.settings.favoritePlugins = this.plugin.settings.favoritePlugins.filter((p) => p !== id);
      }
    );

    this.removableList(
      containerEl,
      "Ignored plugins",
      "No ignored plugins. Use the ignore action on a plugin card to hide it from browsing.",
      this.plugin.settings.ignoredPlugins,
      (id) => {
        this.plugin.settings.ignoredPlugins = this.plugin.settings.ignoredPlugins.filter((p) => p !== id);
      }
    );

    this.removableList(
      containerEl,
      "Ignored authors",
      "No ignored authors. Use a plugin card's ignore menu to hide everything by an author.",
      this.plugin.settings.ignoredAuthors,
      (author) => {
        this.plugin.settings.ignoredAuthors = this.plugin.settings.ignoredAuthors.filter((a) => a !== author);
      }
    );

    this.removableList(
      containerEl,
      "Ignored categories",
      "No ignored categories. Use a plugin card's ignore menu to hide a whole category.",
      this.plugin.settings.ignoredCategories,
      (cat) => {
        this.plugin.settings.ignoredCategories = this.plugin.settings.ignoredCategories.filter((c) => c !== cat);
      }
    );
  }
}
