import type { PluginEntry } from "./types";
import { mergeRegistry, parseRegistry, slimStats } from "./registry";
import { classifyPlugin } from "./categories";
import { appendSnapshot, computeDeltas, historyFor, type Snapshot } from "./trending";
import { newIdsWithin, updateKnownIds, type KnownIds } from "./newness";
import { pendingRepos, type RepoStats } from "./scan";

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
  /** Persistent stars/open-issues cache, loaded lazily from repostats.json. */
  private repoStatsCache: Map<string, RepoStats> | null = null;
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

  private async ensureRepoStats(): Promise<Map<string, RepoStats>> {
    if (this.repoStatsCache == null) {
      const stored = await this.readJson<{ stats?: Record<string, RepoStats> }>("repostats.json");
      this.repoStatsCache = new Map(Object.entries(stored?.stats ?? {}));
    }
    return this.repoStatsCache;
  }

  /**
   * Stars + open issues for one repo — a single API call. Reads through the
   * persistent scan cache first, then any already-fetched enrichment, so cards
   * and sorts reuse scanned data without re-hitting the API.
   */
  async getRepoStats(repo: string): Promise<RepoStats> {
    const cache = await this.ensureRepoStats();
    const hit = cache.get(repo);
    if (hit != null) return hit;
    const enriched = this.enrichments.get(repo);
    if (enriched) {
      const stats: RepoStats = { stars: enriched.stars, openIssues: enriched.openIssues, scannedAt: this.io.now() };
      cache.set(repo, stats);
      return stats;
    }
    const raw = await this.githubFetch(`https://api.github.com/repos/${repo}`);
    const data = JSON.parse(raw) as { stargazers_count?: number; open_issues_count?: number };
    const stats: RepoStats = {
      stars: data.stargazers_count ?? 0,
      openIssues: data.open_issues_count ?? 0,
      scannedAt: this.io.now(),
    };
    cache.set(repo, stats);
    return stats;
  }

  /** Snapshot of all scanned repo stats, keyed by repo. */
  async getAllRepoStats(): Promise<Record<string, RepoStats>> {
    return Object.fromEntries(await this.ensureRepoStats());
  }

  private persistRepoStats(): Promise<void> {
    const cache = this.repoStatsCache;
    if (cache == null) return Promise.resolve();
    return this.serialize(() => this.writeJson("repostats.json", { stats: Object.fromEntries(cache) }));
  }

  /**
   * Scan the given repos for stars/open issues, filling the persistent cache.
   * Resumable and incremental (skips repos scanned within maxAgeMs), cancellable,
   * and rate-limit aware: on a rate-limit error it stops cleanly with progress saved.
   */
  async scanRepos(
    repos: string[],
    opts: {
      maxAgeMs: number;
      concurrency?: number;
      onProgress?: (done: number, total: number) => void;
      isCancelled?: () => boolean;
    }
  ): Promise<{ scanned: number; total: number; rateLimited: boolean; cancelled: boolean }> {
    const cache = await this.ensureRepoStats();
    const now = this.io.now();
    const queue = pendingRepos(repos, Object.fromEntries(cache), now, opts.maxAgeMs);
    const total = queue.length;
    let done = 0;
    let rateLimited = false;
    let cancelled = false;

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        if (rateLimited || cancelled) return;
        if (opts.isCancelled?.()) {
          cancelled = true;
          return;
        }
        const repo = queue.shift();
        if (repo == null) return;
        try {
          await this.getRepoStats(repo);
        } catch (e) {
          if (e instanceof RateLimitError) {
            rateLimited = true;
            return;
          }
          // Skip a single bad repo (404, transient) but keep scanning.
        }
        done++;
        opts.onProgress?.(done, total);
        if (done % 25 === 0) await this.persistRepoStats();
      }
    };

    const workers = Math.max(1, Math.min(opts.concurrency ?? 5, 8));
    await Promise.all(Array.from({ length: workers }, () => worker()));
    await this.persistRepoStats();
    return { scanned: done, total, rateLimited, cancelled };
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
