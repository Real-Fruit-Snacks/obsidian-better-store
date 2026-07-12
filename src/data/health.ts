import { formatAge } from "./format";

export type HealthLevel = "healthy" | "aging" | "at-risk";

export interface HealthInput {
  /** Last-updated ms epoch from the registry stats (0 = unknown). */
  updated: number;
  releases: { publishedAt: string }[];
  now: number;
}

export interface Health {
  level: HealthLevel;
  reasons: string[];
}

const DAY = 86_400_000;

/** Rough maintenance signal: recency of the last update, lifted by an
 * active release cadence. Deliberately simple and explainable. */
export function assessHealth(input: HealthInput): Health {
  const recentReleases = input.releases.filter(
    (r) => r.publishedAt && input.now - Date.parse(r.publishedAt) < 365 * DAY
  ).length;

  const reasons: string[] = [];
  let level: HealthLevel;

  if (input.updated <= 0) {
    level = "aging";
    reasons.push("last update date unknown");
  } else {
    const days = (input.now - input.updated) / DAY;
    if (days <= 120) level = "healthy";
    else if (days <= 365) level = "aging";
    else level = "at-risk";
    reasons.push(`updated ${formatAge(input.updated, input.now)}`);
  }

  if (level === "aging" && recentReleases >= 3) {
    level = "healthy";
  }
  reasons.push(`${recentReleases} release${recentReleases === 1 ? "" : "s"} in the last year`);

  return { level, reasons };
}
