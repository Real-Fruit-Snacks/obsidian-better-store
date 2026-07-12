import { FuzzySuggestModal, Modal, Notice, Setting, type App } from "obsidian";
import type BetterStorePlugin from "../main";
import type { PluginProfile } from "../data/profiles";
import { diffImport, parseImport } from "../data/portability";
import { getPluginsApi } from "./store-context";

/** Small shared prompt for naming profiles and filter presets. */
export class NameModal extends Modal {
  constructor(
    app: App,
    private promptTitle: string,
    private onSubmit: (name: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.promptTitle);
    let value = "";
    const submit = () => {
      const name = value.trim();
      if (!name) {
        new Notice("Enter a name.");
        return;
      }
      this.close();
      this.onSubmit(name);
    };
    new Setting(this.contentEl).setName("Name").addText((text) => {
      text.onChange((v) => (value = v));
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).addButton((btn) => btn.setButtonText("Save").setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** Paste an exported plugin list; shows what's installed vs. missing and
 * can star the missing plugins as an install shopping list. */
export class ImportModal extends Modal {
  constructor(
    app: App,
    private plugin: BetterStorePlugin
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Import plugin list");
    const { contentEl } = this;
    contentEl.createEl("p", {
      text: "Paste a plugin list exported from Better Store (Markdown or JSON).",
      cls: "setting-item-description",
    });
    const textarea = contentEl.createEl("textarea", {
      cls: "bs-import-textarea",
      attr: { rows: "10", placeholder: "Paste the exported list here…", "aria-label": "Exported plugin list" },
    });
    const results = contentEl.createDiv();
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Analyze")
        .setCta()
        .onClick(() => void this.analyze(textarea.value, results))
    );
  }

  private async analyze(text: string, out: HTMLElement): Promise<void> {
    out.empty();
    const ids = parseImport(text);
    if (ids.length === 0) {
      out.createEl("p", { text: "No plugin ids found in the pasted text." });
      return;
    }
    const installed = new Set(Object.keys(getPluginsApi(this.app).manifests));
    const { present, missing } = diffImport(ids, installed);
    out.createEl("p", {
      text: `${ids.length} plugins in the list — ${present.length} already installed, ${missing.length} missing.`,
    });
    if (missing.length === 0) return;

    let names = new Map<string, string>();
    try {
      const catalog = await this.plugin.service.loadCatalog();
      names = new Map(catalog.entries.map((e) => [e.id, e.name]));
    } catch {
      // names stay as raw ids
    }
    const list = out.createEl("ul");
    for (const id of missing) list.createEl("li", { text: names.get(id) ?? id });

    new Setting(out).addButton((btn) =>
      btn.setButtonText(`Star ${missing.length} missing`).onClick(async () => {
        const favorites = new Set(this.plugin.settings.favoritePlugins);
        for (const id of missing) favorites.add(id);
        this.plugin.settings.favoritePlugins = [...favorites];
        await this.plugin.saveSettings();
        new Notice(`Starred ${missing.length} plugins — use the "Starred only" filter to install them.`);
        this.close();
      })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class ProfileSuggestModal extends FuzzySuggestModal<PluginProfile> {
  constructor(
    app: App,
    private plugin: BetterStorePlugin
  ) {
    super(app);
    this.setPlaceholder("Apply plugin profile…");
    this.emptyStateText = "No profiles yet — save one from Better Store's Installed tab.";
  }

  getItems(): PluginProfile[] {
    return this.plugin.settings.profiles;
  }

  getItemText(profile: PluginProfile): string {
    return `${profile.name} (${profile.pluginIds.length} plugins)`;
  }

  onChooseItem(profile: PluginProfile): void {
    void this.plugin.applyProfile(profile);
  }
}
