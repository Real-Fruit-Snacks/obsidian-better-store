import { describe, it, expect, beforeEach } from "vitest";
import { DataService, RateLimitError, REGISTRY_URL, STATS_URL, type ServiceIO } from "../src/data/service";

const HOUR = 3_600_000;

const REGISTRY_JSON = JSON.stringify([
  { id: "dataview", name: "Dataview", author: "MB", description: "query your notes", repo: "blacksmithgu/obsidian-dataview" },
]);
const STATS_JSON = JSON.stringify({ dataview: { downloads: 100, updated: 5, "0.5.0": 10 } });

class FakeIO implements ServiceIO {
  files = new Map<string, string>();
  responses = new Map<string, string>();
  failures = new Map<string, string>(); // url -> error message
  fetchLog: string[] = [];
  time = 1_000_000;

  async readFile(path: string) { return this.files.get(path) ?? null; }
  async writeFile(path: string, data: string) { this.files.set(path, data); }
  async fetchText(url: string) {
    this.fetchLog.push(url);
    const failure = this.failures.get(url);
    if (failure) throw new Error(failure);
    const body = this.responses.get(url);
    if (body == null) throw new Error(`HTTP 404 for ${url}`);
    return body;
  }
  now() { return this.time; }
}

let io: FakeIO;
let service: DataService;

beforeEach(() => {
  io = new FakeIO();
  io.responses.set(REGISTRY_URL, REGISTRY_JSON);
  io.responses.set(STATS_URL, STATS_JSON);
  service = new DataService(io, "plugins/better-store", { ttlMs: 12 * HOUR });
});

describe("loadCatalog", () => {
  it("fetches, merges, and caches on first load", async () => {
    const catalog = await service.loadCatalog();
    expect(catalog.stale).toBe(false);
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0]).toMatchObject({ id: "dataview", downloads: 100, updated: 5 });
    expect(catalog.entries[0].categories).toContain("Data & Queries");
    expect(io.files.has("plugins/better-store/catalog.json")).toBe(true);
  });

  it("serves fresh cache without fetching", async () => {
    await service.loadCatalog();
    io.fetchLog = [];
    io.time += HOUR;
    const catalog = await service.loadCatalog();
    expect(io.fetchLog).toEqual([]);
    expect(catalog.entries).toHaveLength(1);
  });

  it("refetches after TTL expiry and on force", async () => {
    await service.loadCatalog();
    io.fetchLog = [];
    io.time += 13 * HOUR;
    await service.loadCatalog();
    expect(io.fetchLog).toContain(REGISTRY_URL);

    io.fetchLog = [];
    await service.loadCatalog(true);
    expect(io.fetchLog).toContain(REGISTRY_URL);
  });

  it("falls back to stale cache when fetch fails", async () => {
    await service.loadCatalog();
    io.time += 13 * HOUR;
    io.failures.set(REGISTRY_URL, "HTTP 500");
    const catalog = await service.loadCatalog();
    expect(catalog.stale).toBe(true);
    expect(catalog.entries).toHaveLength(1);
  });

  it("throws when fetch fails and no cache exists", async () => {
    io.failures.set(REGISTRY_URL, "HTTP 500");
    await expect(service.loadCatalog()).rejects.toThrow();
  });

  it("records download snapshots for trending", async () => {
    await service.loadCatalog(true);
    io.time += 7 * HOUR;
    io.responses.set(STATS_URL, JSON.stringify({ dataview: { downloads: 150, updated: 5 } }));
    await service.loadCatalog(true);
    const deltas = await service.getTrendingDeltas();
    expect(deltas.dataview).toBe(50);
  });

  it("tracks newly appearing plugins after the first-run baseline", async () => {
    await service.loadCatalog(true);
    expect((await service.getNewIds(14)).size).toBe(0);

    io.time += 24 * HOUR;
    io.responses.set(
      REGISTRY_URL,
      JSON.stringify([
        { id: "dataview", name: "Dataview", author: "MB", description: "query your notes", repo: "blacksmithgu/obsidian-dataview" },
        { id: "brand-new", name: "Brand New", author: "N", description: "fresh", repo: "n/brand-new" },
      ])
    );
    await service.loadCatalog(true);
    const fresh = await service.getNewIds(14);
    expect(fresh.has("brand-new")).toBe(true);
    expect(fresh.has("dataview")).toBe(false);
  });
});

describe("enrichment", () => {
  it("maps 403 responses to RateLimitError", async () => {
    io.failures.set("https://api.github.com/repos/a/b", "HTTP 403 for url");
    await expect(service.getEnrichment("a/b")).rejects.toThrow(RateLimitError);
  });

  it("parses repo, releases, and manifest data", async () => {
    io.responses.set(
      "https://api.github.com/repos/a/b",
      JSON.stringify({ stargazers_count: 42, open_issues_count: 7, created_at: "2022-05-01T00:00:00Z" })
    );
    io.responses.set(
      "https://api.github.com/repos/a/b/releases?per_page=10",
      JSON.stringify([
        {
          tag_name: "1.2.0",
          published_at: "2026-01-01T00:00:00Z",
          html_url: "https://github.com/a/b/releases/tag/1.2.0",
          body: "## Fixed\n- a bug",
        },
      ])
    );
    io.responses.set(
      "https://raw.githubusercontent.com/a/b/HEAD/manifest.json",
      JSON.stringify({ version: "1.2.0", fundingUrl: "https://ko-fi.com/x", minAppVersion: "1.6.0" })
    );
    const e = await service.getEnrichment("a/b");
    expect(e).toEqual({
      stars: 42,
      openIssues: 7,
      releases: [
        {
          tag: "1.2.0",
          publishedAt: "2026-01-01T00:00:00Z",
          url: "https://github.com/a/b/releases/tag/1.2.0",
          body: "## Fixed\n- a bug",
        },
      ],
      latestVersion: "1.2.0",
      minAppVersion: "1.6.0",
      fundingUrl: "https://ko-fi.com/x",
      createdAt: Date.parse("2022-05-01T00:00:00Z"),
    });
  });

  it("rejects non-http(s) fundingUrl schemes", async () => {
    io.responses.set("https://api.github.com/repos/a/b", JSON.stringify({ stargazers_count: 1, open_issues_count: 0 }));
    io.responses.set("https://api.github.com/repos/a/b/releases?per_page=10", JSON.stringify([]));
    io.responses.set(
      "https://raw.githubusercontent.com/a/b/HEAD/manifest.json",
      JSON.stringify({ version: "1.0.0", fundingUrl: "javascript:alert(1)" })
    );
    const e = await service.getEnrichment("a/b");
    expect(e.fundingUrl).toBeNull();
  });
});

describe("repo stats", () => {
  it("fetches stars + open issues + created date with a single request and caches it", async () => {
    io.responses.set(
      "https://api.github.com/repos/a/b",
      JSON.stringify({ stargazers_count: 42, open_issues_count: 7, created_at: "2021-03-04T00:00:00Z" })
    );
    expect(await service.getRepoStats("a/b")).toMatchObject({
      stars: 42,
      openIssues: 7,
      createdAt: Date.parse("2021-03-04T00:00:00Z"),
    });
    expect(io.fetchLog).toEqual(["https://api.github.com/repos/a/b"]);
    io.fetchLog = [];
    await service.getRepoStats("a/b");
    expect(io.fetchLog).toEqual([]);
  });

  it("reuses already-fetched enrichment instead of refetching", async () => {
    io.responses.set("https://api.github.com/repos/a/b", JSON.stringify({ stargazers_count: 42, open_issues_count: 7 }));
    io.responses.set("https://api.github.com/repos/a/b/releases?per_page=10", JSON.stringify([]));
    await service.getEnrichment("a/b");
    io.fetchLog = [];
    expect(await service.getRepoStats("a/b")).toMatchObject({ stars: 42, openIssues: 7 });
    expect(io.fetchLog).toEqual([]);
  });

  it("maps rate-limit failures to RateLimitError", async () => {
    io.failures.set("https://api.github.com/repos/a/b", "HTTP 403 for url");
    await expect(service.getRepoStats("a/b")).rejects.toThrow(RateLimitError);
  });

  it("hasGithubToken reflects whether requests carry a token", () => {
    expect(service.hasGithubToken()).toBe(false);
    const withToken = new DataService(io, "p", { ttlMs: HOUR, githubToken: "t" });
    expect(withToken.hasGithubToken()).toBe(true);
  });

  it("normalizes a legacy repostats cache that predates createdAt", async () => {
    // An entry written before createdAt existed: no createdAt, has a scannedAt.
    io.files.set(
      "plugins/better-store/repostats.json",
      JSON.stringify({ stats: { "a/legacy": { stars: 42, openIssues: 3, scannedAt: 111 } } })
    );
    const all = await service.getAllRepoStats();
    // createdAt backfilled to 0, and scannedAt reset so it re-scans (backfilling the date).
    expect(all["a/legacy"]).toEqual({ stars: 42, openIssues: 3, createdAt: 0, scannedAt: 0 });
  });
});

describe("scanRepos", () => {
  function setRepo(repo: string, stars: number, issues: number) {
    io.responses.set(`https://api.github.com/repos/${repo}`, JSON.stringify({ stargazers_count: stars, open_issues_count: issues }));
  }

  it("scans pending repos, persists the cache, and reports progress", async () => {
    setRepo("a/1", 10, 1);
    setRepo("a/2", 20, 2);
    const progress: number[] = [];
    const res = await service.scanRepos(["a/1", "a/2"], {
      maxAgeMs: HOUR,
      concurrency: 1,
      onProgress: (done) => progress.push(done),
    });
    expect(res).toMatchObject({ scanned: 2, total: 2, rateLimited: false, cancelled: false });
    expect(progress).toEqual([1, 2]);
    const all = await service.getAllRepoStats();
    expect(all["a/1"]).toMatchObject({ stars: 10, openIssues: 1 });
    expect(all["a/2"]).toMatchObject({ stars: 20, openIssues: 2 });
    expect(io.files.has("plugins/better-store/repostats.json")).toBe(true);
  });

  it("skips repos already scanned within the freshness window", async () => {
    setRepo("a/1", 10, 1);
    await service.scanRepos(["a/1"], { maxAgeMs: 24 * HOUR, concurrency: 1 });
    io.fetchLog = [];
    const res = await service.scanRepos(["a/1"], { maxAgeMs: 24 * HOUR, concurrency: 1 });
    expect(res.total).toBe(0);
    expect(io.fetchLog).toEqual([]);
  });

  it("halts cleanly on a rate limit with progress saved", async () => {
    setRepo("a/1", 10, 1);
    io.failures.set("https://api.github.com/repos/a/2", "HTTP 403 for url");
    const res = await service.scanRepos(["a/1", "a/2"], { maxAgeMs: HOUR, concurrency: 1 });
    expect(res.rateLimited).toBe(true);
    const all = await service.getAllRepoStats();
    expect(all["a/1"]).toMatchObject({ stars: 10 });
    expect(all["a/2"]).toBeUndefined();
  });

  it("stops when cancelled", async () => {
    setRepo("a/1", 10, 1);
    setRepo("a/2", 20, 2);
    let calls = 0;
    const res = await service.scanRepos(["a/1", "a/2"], {
      maxAgeMs: HOUR,
      concurrency: 1,
      isCancelled: () => calls++ >= 1, // allow the first, cancel before the second
    });
    expect(res.cancelled).toBe(true);
    expect(res.scanned).toBe(1);
  });
});

describe("getReadme / getLatestVersion", () => {
  it("fetches and memory-caches READMEs", async () => {
    io.responses.set("https://raw.githubusercontent.com/a/b/HEAD/README.md", "# Hello");
    expect(await service.getReadme("a/b")).toBe("# Hello");
    io.fetchLog = [];
    await service.getReadme("a/b");
    expect(io.fetchLog).toEqual([]);
  });

  it("falls back to lowercase readme.md when README.md is missing", async () => {
    io.responses.set("https://raw.githubusercontent.com/c/d/HEAD/readme.md", "# lower");
    expect(await service.getReadme("c/d")).toBe("# lower");
  });

  it("getLatestVersion returns null on failure", async () => {
    expect(await service.getLatestVersion("a/missing")).toBeNull();
  });
});
