import { Notice, Platform, Plugin, requestUrl } from "obsidian";
import { DataService, type ServiceIO } from "./data/service";
import { compareVersions } from "./data/versions";
import { resolveLegacySecret, summarizeTokenCheck } from "./data/token";
import { buildExportList, exportJson, exportMarkdown } from "./data/portability";
import { diffProfile, type PluginProfile } from "./data/profiles";
import { BetterStoreSettingTab, DEFAULT_SETTINGS, type BetterStoreSettings } from "./settings";
import { BetterStoreView, VIEW_TYPE_BETTER_STORE } from "./view";
import { QuickJumpModal } from "./ui/QuickJumpModal";
import { ImportModal, ProfileSuggestModal } from "./ui/modals";
import { getPluginsApi } from "./ui/store-context";

/** Secret-storage id for the optional GitHub token (Obsidian keychain). */
const GITHUB_TOKEN_SECRET = "better-store-github-token";

export default class BetterStorePlugin extends Plugin {
  settings: BetterStoreSettings = DEFAULT_SETTINGS;
  service!: DataService;
  /** Set when a detail view is requested before the store view has loaded. */
  pendingDetailId: string | null = null;
  private settingsListeners: (() => void)[] = [];
  private detailListeners: ((id: string) => void)[] = [];
  private tokenListeners: (() => void)[] = [];
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
    this.addCommand({
      id: "export-plugin-list",
      name: "Export plugin list (Markdown)",
      callback: () => void this.exportPluginList("markdown"),
    });
    this.addCommand({
      id: "export-plugin-list-json",
      name: "Export plugin list (JSON)",
      callback: () => void this.exportPluginList("json"),
    });
    this.addCommand({
      id: "import-plugin-list",
      name: "Import plugin list",
      callback: () => new ImportModal(this.app, this).open(),
    });
    this.addCommand({
      id: "apply-profile",
      name: "Apply plugin profile",
      callback: () => new ProfileSuggestModal(this.app, this).open(),
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
      // Recently viewed plugins float to the top of the (stable-sorted) list.
      const rank = new Map(this.settings.ui.recentlyViewed.map((id, i) => [id, i]));
      const entries = this.settings.trackRecentlyViewed
        ? [...catalog.entries].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
        : catalog.entries;
      new QuickJumpModal(this.app, entries, (entry) => void this.openPluginDetail(entry.id)).open();
    } catch {
      new Notice("Better Store: could not load the plugin catalog.");
    }
  }

  async exportPluginList(format: "markdown" | "json"): Promise<void> {
    const api = getPluginsApi(this.app);
    const list = buildExportList(api.manifests, new Set(api.enabledPlugins));
    const text =
      format === "json" ? exportJson(list) : exportMarkdown(list, new Date().toISOString().slice(0, 10));
    await navigator.clipboard.writeText(text);
    new Notice(`Better Store: copied ${list.length} plugins to the clipboard as ${format === "json" ? "JSON" : "Markdown"}.`);
  }

  /** Enable/disable installed plugins to match a saved profile. */
  async applyProfile(profile: PluginProfile): Promise<void> {
    const api = getPluginsApi(this.app);
    const diff = diffProfile(
      profile.pluginIds,
      new Set(api.enabledPlugins),
      new Set(Object.keys(api.manifests)),
      this.manifest.id
    );
    try {
      for (const id of diff.toEnable) await api.enablePluginAndSave(id);
      for (const id of diff.toDisable) await api.disablePluginAndSave(id);
      const missing = diff.missing.length > 0 ? `, ${diff.missing.length} not installed` : "";
      new Notice(`Profile "${profile.name}": ${diff.toEnable.length} enabled, ${diff.toDisable.length} disabled${missing}.`);
    } catch (e) {
      new Notice(`Profile "${profile.name}" failed: ${e instanceof Error ? e.message : String(e)}`);
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
      await this.app.workspace.revealLeaf(existing);
      return;
    }
    // Popout windows are desktop-only; fall back to a tab elsewhere.
    const location =
      this.settings.openLocation === "window" && !Platform.isDesktopApp ? "tab" : this.settings.openLocation;
    const leaf = this.app.workspace.getLeaf(location);
    await leaf.setViewState({ type: VIEW_TYPE_BETTER_STORE, active: true });
    await this.app.workspace.revealLeaf(leaf);
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
      githubToken: this.getGithubToken() || undefined,
    });
  }

  /** Resolve the GitHub token from the secret the user linked in settings. */
  getGithubToken(): string {
    const id = this.settings.githubSecretId;
    return id ? this.app.secretStorage.getSecret(id) ?? "" : "";
  }

  /** Store which secret holds the GitHub token and refresh the service. */
  async setGithubSecretId(id: string): Promise<void> {
    this.settings.githubSecretId = id;
    await this.saveSettings();
    this.service = this.createService();
  }

  /**
   * Check the linked token against the GitHub API and report the result in a
   * notice. Returns whether the token was accepted.
   */
  async testGithubToken(): Promise<boolean> {
    const id = this.settings.githubSecretId;
    if (id && this.app.secretStorage.getSecret(id) == null) {
      new Notice(`The linked secret "${id}" no longer exists — link another one.`);
      return false;
    }
    const token = this.getGithubToken();
    try {
      // /rate_limit is free — it never counts against the quota.
      const res = await requestUrl({
        url: "https://api.github.com/rate_limit",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        throw: false,
      });
      const check = summarizeTokenCheck(token !== "", res.status, res.text);
      new Notice(check.message);
      return check.valid;
    } catch {
      new Notice("Could not reach the GitHub API — check your connection.");
      return false;
    }
  }

  /**
   * A token was just linked and verified: put it to work right away.
   * Open views re-fetch GitHub data that may have failed on the anonymous
   * rate limit, and the update check reruns now that it can afford to.
   */
  onTokenLinked(): void {
    for (const cb of this.tokenListeners) cb();
    if (this.settings.backgroundUpdateCheck) void this.checkForUpdates();
  }

  registerTokenListener(cb: () => void): () => void {
    this.tokenListeners.push(cb);
    return () => {
      this.tokenListeners = this.tokenListeners.filter((c) => c !== cb);
    };
  }

  registerSettingsListener(cb: () => void): () => void {
    this.settingsListeners.push(cb);
    return () => {
      this.settingsListeners = this.settingsListeners.filter((c) => c !== cb);
    };
  }

  async loadSettings(): Promise<void> {
    const raw = (((await this.loadData()) as (Partial<BetterStoreSettings> & { githubToken?: string }) | null) ?? {});
    this.settings = { ...structuredClone(DEFAULT_SETTINGS), ...raw };
    this.settings.ui = { ...structuredClone(DEFAULT_SETTINGS.ui), ...(raw.ui ?? {}) };
    // Pre-0.3.2 versions kept the GitHub token in plain data.json; move it
    // into Obsidian's secret storage and scrub it from plugin data.
    if (typeof raw.githubToken === "string") {
      if (raw.githubToken && !this.app.secretStorage.getSecret(GITHUB_TOKEN_SECRET)) {
        this.app.secretStorage.setSecret(GITHUB_TOKEN_SECRET, raw.githubToken);
        this.settings.githubSecretId = GITHUB_TOKEN_SECRET;
      }
      delete (this.settings as unknown as Record<string, unknown>).githubToken;
      await this.saveData(this.settings);
    }
    // 0.3.2–0.3.7 misread the settings' secret input and wrote the *name* of
    // the secret the user linked into the plugin's own secret as if it were
    // the token. Point the setting at the right secret and scrub the junk.
    if (!this.settings.githubSecretId) {
      const resolved = resolveLegacySecret(
        this.app.secretStorage.getSecret(GITHUB_TOKEN_SECRET),
        GITHUB_TOKEN_SECRET,
        this.app.secretStorage.listSecrets()
      );
      if (resolved.secretId || resolved.scrubLegacy) {
        this.settings.githubSecretId = resolved.secretId;
        if (resolved.scrubLegacy) this.app.secretStorage.setSecret(GITHUB_TOKEN_SECRET, "");
        await this.saveData(this.settings);
      }
    }
  }

  private currentServiceKey(): string {
    return `${this.settings.cacheTtlHours}`;
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
