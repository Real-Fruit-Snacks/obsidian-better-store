/** One repo's scanned GitHub stats, with the time it was fetched. */
export interface RepoStats {
  stars: number;
  openIssues: number;
  /** GitHub repo creation time (ms epoch); a proxy for the plugin's first release. 0 = unknown. */
  createdAt: number;
  scannedAt: number;
}

/**
 * Repos still needing a scan: never scanned, or scanned longer ago than
 * maxAgeMs. Never-scanned repos come first (in catalog order), then the
 * stalest previously-scanned ones — so a resumed/incremental scan makes the
 * most visible progress first.
 */
export function pendingRepos(
  repos: string[],
  cache: Record<string, RepoStats>,
  now: number,
  maxAgeMs: number
): string[] {
  const seen = new Set<string>();
  const ranked: { repo: string; key: number }[] = [];
  for (const repo of repos) {
    if (seen.has(repo)) continue;
    seen.add(repo);
    const entry = cache[repo];
    if (entry == null) {
      ranked.push({ repo, key: -Infinity }); // never scanned → highest priority
    } else if (now - entry.scannedAt >= maxAgeMs) {
      ranked.push({ repo, key: entry.scannedAt }); // stale → oldest first
    }
  }
  return ranked
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((r) => r.repo);
}

/** How many distinct repos have any scanned entry, out of the catalog total. */
export function scanCoverage(
  repos: string[],
  cache: Record<string, RepoStats>
): { scanned: number; total: number } {
  const unique = new Set(repos);
  let scanned = 0;
  for (const repo of unique) if (cache[repo] != null) scanned++;
  return { scanned, total: unique.size };
}
