import { Plugin, requestUrl } from "obsidian";
import { DataService, type ServiceIO } from "./data/service";
import { BetterStoreSettingTab, DEFAULT_SETTINGS, type BetterStoreSettings } from "./settings";
import { BetterStoreView, VIEW_TYPE_BETTER_STORE } from "./view";

export default class BetterStorePlugin extends Plugin {
  settings: BetterStoreSettings = DEFAULT_SETTINGS;
  service!: DataService;
  private settingsListeners: (() => void)[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();
    this.service = this.createService();
    this.addSettingTab(new BetterStoreSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_BETTER_STORE, (leaf) => new BetterStoreView(leaf, this));
    this.addRibbonIcon("store", "Open Better Store", () => void this.activateView());
    this.addCommand({ id: "open", name: "Open store", callback: () => void this.activateView() });
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_BETTER_STORE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_BETTER_STORE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  createService(): DataService {
    const adapter = this.app.vault.adapter;
    const io: ServiceIO = {
      readFile: async (path) => ((await adapter.exists(path)) ? adapter.read(path) : null),
      writeFile: (path, data) => adapter.write(path, data),
      fetchText: async (url, headers) => {
        const res = await requestUrl({ url, headers, throw: false });
        if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.text;
      },
      now: () => Date.now(),
    };
    return new DataService(io, this.manifest.dir ?? ".", {
      ttlMs: this.settings.cacheTtlHours * 3_600_000,
      githubToken: this.settings.githubToken || undefined,
    });
  }

  registerSettingsListener(cb: () => void): () => void {
    this.settingsListeners.push(cb);
    return () => {
      this.settingsListeners = this.settingsListeners.filter((c) => c !== cb);
    };
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...structuredClone(DEFAULT_SETTINGS), ...((await this.loadData()) ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Token/TTL changes need a fresh service.
    this.service = this.createService();
    for (const cb of this.settingsListeners) cb();
  }
}
