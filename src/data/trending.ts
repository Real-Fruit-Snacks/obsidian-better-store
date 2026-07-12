export interface Snapshot {
  ts: number;
  downloads: Record<string, number>;
}

const DEFAULTS = { maxSnapshots: 30, minIntervalMs: 6 * 3_600_000 };

/** Append a download-count snapshot. Returns the same array reference when skipped
 * (previous snapshot too recent) so callers can cheaply detect "nothing changed". */
export function appendSnapshot(
  history: Snapshot[],
  snap: Snapshot,
  opts?: { maxSnapshots?: number; minIntervalMs?: number }
): Snapshot[] {
  const { maxSnapshots, minIntervalMs } = { ...DEFAULTS, ...opts };
  const last = history[history.length - 1];
  if (last && snap.ts - last.ts < minIntervalMs) return history;
  return [...history, snap].slice(-maxSnapshots);
}

/** Download growth per plugin from oldest to newest snapshot. Plugins missing from
 * the oldest snapshot are omitted (no baseline). */
export function computeDeltas(history: Snapshot[]): Record<string, number> {
  if (history.length < 2) return {};
  const first = history[0];
  const last = history[history.length - 1];
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(last.downloads)) {
    const baseline = first.downloads[id];
    if (baseline != null) out[id] = n - baseline;
  }
  return out;
}
