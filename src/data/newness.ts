/** Tracks when each plugin id first appeared in the registry so "New" can be
 * detected. The very first run baselines every existing id with timestamp 0
 * (nothing is new); ids that appear on later refreshes get stamped. */
export interface KnownIds {
  firstSeen: Record<string, number>;
}

export function updateKnownIds(known: KnownIds | null, currentIds: string[], now: number): KnownIds {
  if (known == null) {
    return { firstSeen: Object.fromEntries(currentIds.map((id) => [id, 0])) };
  }
  const firstSeen = { ...known.firstSeen };
  for (const id of currentIds) {
    if (!(id in firstSeen)) firstSeen[id] = now;
  }
  return { firstSeen };
}

export function newIdsWithin(known: KnownIds, days: number, now: number): Set<string> {
  const cutoff = now - days * 86_400_000;
  return new Set(
    Object.entries(known.firstSeen)
      .filter(([, ts]) => ts > 0 && ts >= cutoff)
      .map(([id]) => id)
  );
}
