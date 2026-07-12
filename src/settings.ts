import { App, PluginSettingTab, Setting } from "obsidian";
import type { SortKey } from "./data/filter";
import type BetterStorePlugin from "./main";

export interface BetterStoreSettings {
  githubToken: string;
  cacheTtlHours: number;
  defaultSort: SortKey;
  hideInstalledByDefault: boolean;
  ignoredPlugins: string[];
}

export const DEFAULT_SETTINGS: BetterStoreSettings = {
  githubToken: "",
  cacheTtlHours: 12,
  defaultSort: "downloads",
  hideInstalledByDefault: false,
  ignoredPlugins: [],
};

export class BetterStoreSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: BetterStorePlugin) {
    super(app, plugin);
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

    new Setting(containerEl).setName("Ignored plugins").setHeading();
    if (this.plugin.settings.ignoredPlugins.length === 0) {
      containerEl.createEl("p", {
        text: "No ignored plugins. Use the ignore action on a plugin card to hide it from browsing.",
        cls: "setting-item-description",
      });
    }
    for (const id of [...this.plugin.settings.ignoredPlugins]) {
      new Setting(containerEl).setName(id).addExtraButton((btn) =>
        btn
          .setIcon("x")
          .setTooltip("Stop ignoring")
          .onClick(async () => {
            this.plugin.settings.ignoredPlugins = this.plugin.settings.ignoredPlugins.filter((p) => p !== id);
            await this.plugin.saveSettings();
            this.display();
          })
      );
    }
  }
}
