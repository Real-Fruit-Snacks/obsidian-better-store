import type { PluginEntry } from "./types";
import { mergeRegistry, parseRegistry, slimStats } from "./registry";
import { classifyPlugin } from "./categories";
import { appendSnapshot, computeDeltas, historyFor, type Snapshot } from "./trending";
import { newIdsWithin, updateKnownIds, type KnownIds } from "./newness";

export const REGISTRY_URL =
  "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json";
export const STATS_URL =
  "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugin-stats.json";

export interface ServiceIO {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, data: string): Promise<void>;
  /** Must throw an Error whose message contains "HTTP <status>" on non-2xx responses. */
  fetchText(url: string, headers?: Record<string, string>): Promise<string>;
  now(): number;
}

export class RateLimitError extends Error {
  constructor() {
    super("GitHub API rate limit reached. Add a GitHub token in Better Store settings to raise it.");
    this.name = "RateLimitError";
  }
}

export interface Catalog {
  entries: PluginEntry[];
  fetchedAt: number;
  stale: boolean;
}

export interface Release {
  tag: string;
  publishedAt: string;
  url: string;
  /** Release notes markdown body ("" when the author wrote none). */
  body: string;
}

export interface Enrichment {
  stars: number;
  openIssues: number;
  releases: Release[];
  latestVersion: string | null;
  /** Minimum Obsidian version from the plugin's manifest, if declared. */
  minAppVersion: string | null;
  fundingUrl: string | null;
}

export class DataService {
  private readmes = new Map<string, string>();
  private enrichments = new Map<string, Enrichment>();
  private repoStars = new Map<string, number>();
  /** Serializes read-modify-write operations on the local snapshot files. */
  private writeLock: Promise<unknown> = Promise.resolve();

  constructor(
    private io: ServiceIO,
    private cacheDir: string,
    private opts: { ttlMs: number; githubToken?: string }
  ) {}

  /**
   * Run a read-modify-write task after any previous one finishes, so overlapping
   * catalog refreshes can't interleave their updates to history.json/known.json.
   */
  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeLock.then(task, task);
    this.writeLock = run.catch(() => {});
    return run;
  }

  private async readJson<T>(name: string): Promise<T | null> {
    const raw = await this.io.readFile(`${this.cacheDir}/${name}`);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private writeJson(name: string, value: unknown): Promise<void> {
    return this.io.writeFile(`${this.cacheDir}/${name}`, JSON.stringify(value));
  }

  async loadCatalog(force = false): Promise<Catalog> {
    const cachedRaw = await this.readJson<{ fetchedAt: number; entries: PluginEntry[] }>("catalog.json");
    const cached =
      cachedRaw != null && Array.isArray(cachedRaw.entries) && typeof cachedRaw.fetchedAt === "number"
        ? cachedRaw
        : null;
    const fresh = cached != null && this.io.now() - cached.fetchedAt < this.opts.ttlMs;
    if (cached && fresh && !force) return { ...cached, stale: false };

    try {
      const [registryRaw, statsRaw] = await Promise.all([
        this.io.fetchText(REGISTRY_URL),
        this.io.fetchText(STATS_URL),
      ]);
      const entries = mergeRegistry(
        parseRegistry(JSON.parse(registryRaw)),
        slimStats(JSON.parse(statsRaw)),
        classifyPlugin
      );
      const catalog = { entries, fetchedAt: this.io.now() };
      await this.writeJson("catalog.json", catalog);
      await this.recordSnapshot(entries);
      await this.recordKnownIds(entries);
      return { ...catalog, stale: false };
    } catch (e) {
      if (cached) return { ...cached, stale: true };
      throw e;
    }
  }

  private recordSnapshot(entries: PluginEntry[]): Promise<void> {
    return this.serialize(async () => {
      const history = (await this.readJson<Snapshot[]>("history.json")) ?? [];
      const snap: Snapshot = {
        ts: this.io.now(),
        downloads: Object.fromEntries(entries.map((e) => [e.id, e.downloads])),
      };
      const next = appendSnapshot(history, snap);
      if (next !== history) await this.writeJson("history.json", next);
    });
  }

  async getTrendingDeltas(): Promise<Record<string, number>> {
    return computeDeltas((await this.readJson<Snapshot[]>("history.json")) ?? []);
  }

  private recordKnownIds(entries: PluginEntry[]): Promise<void> {
    return this.serialize(async () => {
      const known = await this.readJson<KnownIds>("known.json");
      const next = updateKnownIds(
        known != null && typeof known.firstSeen === "object" ? known : null,
        entries.map((e) => e.id),
        this.io.now()
      );
      await this.writeJson("known.json", next);
    });
  }

  /** Ids of plugins that first appeared in the registry within the last N days. */
  async getNewIds(days: number): Promise<Set<string>> {
    const known = await this.readJson<KnownIds>("known.json");
    if (known == null || typeof known.firstSeen !== "object") return new Set();
    return newIdsWithin(known, days, this.io.now());
  }

  /** True when requests carry a GitHub token (raised rate limit). */
  hasGithubToken(): boolean {
    return Boolean(this.opts.githubToken);
  }

  /** Star count only — a single API call, cheap enough for card-level display. */
  async getRepoStats(repo: string): Promise<{ stars: number }> {
    const hit = this.repoStars.get(repo);
    if (hit != null) return { stars: hit };
    const enriched = this.enrichments.get(repo);
    if (enriched) {
      this.repoStars.set(repo, enriched.stars);
      return { stars: enriched.stars };
    }
    const raw = await this.githubFetch(`https://api.github.com/repos/${repo}`);
    const stars = (JSON.parse(raw) as { stargazers_count?: number }).stargazers_count ?? 0;
    this.repoStars.set(repo, stars);
    return { stars };
  }

  private githubHeaders(): Record<string, string> | undefined {
    return this.opts.githubToken ? { Authorization: `Bearer ${this.opts.githubToken}` } : undefined;
  }

  private async githubFetch(url: string): Promise<string> {
    try {
      return await this.io.fetchText(url, this.githubHeaders());
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (msg.includes("HTTP 403") || msg.includes("HTTP 429")) throw new RateLimitError();
      throw e;
    }
  }

  async getReadme(repo: string): Promise<string> {
    const hit = this.readmes.get(repo);
    if (hit != null) return hit;
    // raw.githubusercontent.com is case-sensitive; try common casings.
    let lastError: unknown = new Error(`no README found for ${repo}`);
    for (const name of ["README.md", "readme.md", "Readme.md"]) {
      try {
        const text = await this.io.fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/${name}`);
        this.readmes.set(repo, text);
        return text;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  /** One plugin's download series from the stored trending snapshots. */
  async getDownloadHistory(id: string): Promise<{ ts: number; downloads: number }[]> {
    return historyFor((await this.readJson<Snapshot[]>("history.json")) ?? [], id);
  }

  async getEnrichment(repo: string): Promise<Enrichment> {
    const hit = this.enrichments.get(repo);
    if (hit) return hit;

    const [repoRaw, releasesRaw, manifestRaw] = await Promise.all([
      this.githubFetch(`https://api.github.com/repos/${repo}`),
      this.githubFetch(`https://api.github.com/repos/${repo}/releases?per_page=10`),
      this.io
        .fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/manifest.json`)
        .catch(() => null),
    ]);

    const repoData = JSON.parse(repoRaw) as { stargazers_count?: number; open_issues_count?: number };
    type RawRelease = { tag_name?: string; published_at?: string; html_url?: string; body?: string };
    let releasesData: RawRelease[];
    try {
      releasesData = JSON.parse(releasesRaw) as RawRelease[];
    } catch {
      releasesData = []; // releases are non-critical; a bad body just means no notes
    }
    let manifest: { version?: string; fundingUrl?: string; minAppVersion?: string } = {};
    if (manifestRaw != null) {
      try {
        manifest = JSON.parse(manifestRaw) as { version?: string; fundingUrl?: string; minAppVersion?: string };
      } catch {
        manifest = {};
      }
    }

    const enrichment: Enrichment = {
      stars: repoData.stargazers_count ?? 0,
      openIssues: repoData.open_issues_count ?? 0,
      releases: (Array.isArray(releasesData) ? releasesData : []).map((r) => ({
        tag: r.tag_name ?? "",
        publishedAt: r.published_at ?? "",
        url: r.html_url ?? "",
        body: typeof r.body === "string" ? r.body : "",
      })),
      latestVersion: typeof manifest.version === "string" ? manifest.version : null,
      minAppVersion: typeof manifest.minAppVersion === "string" ? manifest.minAppVersion : null,
      fundingUrl:
        typeof manifest.fundingUrl === "string" && /^https?:\/\//i.test(manifest.fundingUrl)
          ? manifest.fundingUrl
          : null,
    };
    this.enrichments.set(repo, enrichment);
    return enrichment;
  }

  async getLatestVersion(repo: string): Promise<string | null> {
    try {
      const raw = await this.io.fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/manifest.json`);
      const manifest = JSON.parse(raw) as { version?: string };
      return typeof manifest.version === "string" ? manifest.version : null;
    } catch {
      return null;
    }
  }
}
