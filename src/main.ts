import { Notice, Plugin, requestUrl } from "obsidian";
import { DataService, type ServiceIO } from "./data/service";
import { compareVersions } from "./data/versions";
import { BetterStoreSettingTab, DEFAULT_SETTINGS, type BetterStoreSettings } from "./settings";
import { BetterStoreView, VIEW_TYPE_BETTER_STORE } from "./view";
import { QuickJumpModal } from "./ui/QuickJumpModal";
import { getPluginsApi } from "./ui/store-context";

export default class BetterStorePlugin extends Plugin {
  settings: BetterStoreSettings = DEFAULT_SETTINGS;
  service!: DataService;
  /** Set when a detail view is requested before the store view has loaded. */
  pendingDetailId: string | null = null;
  private settingsListeners: (() => void)[] = [];
  private detailListeners: ((id: string) => void)[] = [];
  private serviceKey = "";
  private ribbonEl: HTMLElement | null = null;
  private lastNotifiedUpdateCount = 0;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.service = this.createService();
    this.serviceKey = this.currentServiceKey();
    this.addSettingTab(new BetterStoreSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_BETTER_STORE, (leaf) => new BetterStoreView(leaf, this));
    this.ribbonEl = this.addRibbonIcon("store", "Open Better Store", () => void this.activateView());
    this.addCommand({ id: "open", name: "Open store", callback: () => void this.activateView() });
    this.addCommand({
      id: "search-plugins",
      name: "Search plugins",
      callback: () => void this.openQuickJump(),
    });

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.backgroundUpdateCheck) {
        void this.checkForUpdates();
      }
      this.registerInterval(
        window.setInterval(() => {
          if (this.settings.backgroundUpdateCheck) void this.checkForUpdates();
        }, Math.max(1, this.settings.cacheTtlHours) * 3_600_000)
      );
    });
  }

  async openQuickJump(): Promise<void> {
    try {
      const catalog = await this.service.loadCatalog();
      new QuickJumpModal(this.app, catalog.entries, (entry) => void this.openPluginDetail(entry.id)).open();
    } catch {
      new Notice("Better Store: could not load the plugin catalog.");
    }
  }

  /** Open (or reveal) the store and show the given plugin's detail pane. */
  async openPluginDetail(id: string): Promise<void> {
    this.pendingDetailId = id;
    await this.activateView();
    for (const cb of this.detailListeners) cb(id);
  }

  registerDetailListener(cb: (id: string) => void): () => void {
    this.detailListeners.push(cb);
    return () => {
      this.detailListeners = this.detailListeners.filter((c) => c !== cb);
    };
  }

  /** Count installed catalog plugins with newer upstream versions; badge the ribbon. */
  async checkForUpdates(): Promise<number> {
    try {
      const catalog = await this.service.loadCatalog();
      const byId = new Map(catalog.entries.map((e) => [e.id, e]));
      const manifests = getPluginsApi(this.app).manifests;
      let count = 0;
      await Promise.all(
        Object.values(manifests).map(async (m) => {
          if (m.id === this.manifest.id) return;
          const entry = byId.get(m.id);
          if (!entry) return;
          const latest = await this.service.getLatestVersion(entry.repo);
          if (latest != null && compareVersions(latest, m.version) > 0) count++;
        })
      );
      this.ribbonEl?.toggleClass("bs-ribbon-updates", count > 0);
      this.ribbonEl?.setAttribute(
        "aria-label",
        count > 0 ? `Better Store — ${count} update${count === 1 ? "" : "s"} available` : "Open Better Store"
      );
      if (this.settings.updateNotice && count > this.lastNotifiedUpdateCount) {
        new Notice(`Better Store: ${count} plugin update${count === 1 ? "" : "s"} available.`);
      }
      this.lastNotifiedUpdateCount = count;
      return count;
    } catch {
      return 0;
    }
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_BETTER_STORE)[0];
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
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

  private currentServiceKey(): string {
    return `${this.settings.githubToken}|${this.settings.cacheTtlHours}`;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Token/TTL changes need a fresh service.
    const key = this.currentServiceKey();
    if (key !== this.serviceKey) {
      this.serviceKey = key;
      this.service = this.createService();
    }
    for (const cb of this.settingsListeners) cb();
  }
}
