import { compareVersions } from "./versions";

/** User preferences that suppress update notifications. */
export interface UpdatePrefs {
  /** Plugin ids the user never wants update checks for. */
  ignored: string[];
  /** Plugin id → version the user chose to skip; resurfaces once a newer version ships. */
  skipped: Record<string, string>;
  /** Epoch ms until which all update nags are muted; 0 = not muted. */
  muteUntil: number;
}

export const EMPTY_UPDATE_PREFS: UpdatePrefs = { ignored: [], skipped: {}, muteUntil: 0 };

export type MuteDuration = "1h" | "8h" | "1d" | "3d" | "1w";

const DURATION_MS: Record<MuteDuration, number> = {
  "1h": 3_600_000,
  "8h": 8 * 3_600_000,
  "1d": 24 * 3_600_000,
  "3d": 3 * 24 * 3_600_000,
  "1w": 7 * 24 * 3_600_000,
};

export const MUTE_OPTIONS: { value: MuteDuration; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "8h", label: "8 hours" },
  { value: "1d", label: "1 day" },
  { value: "3d", label: "3 days" },
  { value: "1w", label: "1 week" },
];

/** Absolute deadline for a mute duration starting now. */
export function muteDeadline(choice: MuteDuration, now: number): number {
  return now + DURATION_MS[choice];
}

export function isMuted(prefs: UpdatePrefs, now: number): boolean {
  return prefs.muteUntil > now;
}

/**
 * Whether an available update should surface, given per-plugin preferences.
 * Global mute is intentionally separate — it silences proactive nags but does
 * not hide updates from the Installed tab, where the user is actively looking.
 */
export function isUpdateActionable(id: string, latest: string, prefs: UpdatePrefs): boolean {
  if (prefs.ignored.includes(id)) return false;
  const skipped = prefs.skipped[id];
  // Still skipped while the latest version isn't newer than the skipped one.
  if (skipped != null && compareVersions(latest, skipped) <= 0) return false;
  return true;
}

/** A short "muted for 2d 3h" style remaining-time label, or null when not muted. */
export function muteRemaining(prefs: UpdatePrefs, now: number): string | null {
  const ms = prefs.muteUntil - now;
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}
