/**
 * Repair the secret state left behind by 0.3.2–0.3.7, which wrote the *name*
 * of the secret the user linked into the plugin's own secret as if it were
 * the token. Returns which secret id the settings should link to, and whether
 * the plugin's legacy secret holds junk that should be scrubbed.
 */
export function resolveLegacySecret(
  legacyValue: string | null,
  legacyId: string,
  existingIds: string[]
): { secretId: string; scrubLegacy: boolean } {
  if (!legacyValue) return { secretId: "", scrubLegacy: false };
  if (legacyValue === legacyId) return { secretId: "", scrubLegacy: true };
  // A secret name written by the bug matches an existing secret; a real
  // token (ghp_…, github_pat_…) can never be a valid secret id.
  if (existingIds.includes(legacyValue)) return { secretId: legacyValue, scrubLegacy: true };
  return { secretId: legacyId, scrubLegacy: false };
}

/** Interpret a GitHub `/rate_limit` response as a human-readable token check. */
export function summarizeTokenCheck(hasToken: boolean, status: number, body: string): string {
  if (status === 401) return "GitHub token is invalid or expired.";
  if (status >= 400) return `GitHub API returned HTTP ${status} — try again later.`;

  let limit: number | undefined;
  let remaining: number | undefined;
  try {
    const parsed = JSON.parse(body) as {
      resources?: { core?: { limit?: number; remaining?: number } };
      rate?: { limit?: number; remaining?: number };
    };
    const core = parsed.resources?.core ?? parsed.rate;
    limit = core?.limit;
    remaining = core?.remaining;
  } catch {
    // fall through to the generic message
  }
  if (limit == null || remaining == null) return "GitHub API responded, but the rate limit could not be read.";

  const quota = `${remaining.toLocaleString()} of ${limit.toLocaleString()} requests remaining this hour`;
  if (!hasToken) return `No token set — using the anonymous limit (${quota}).`;
  // A valid token raises the core limit well above the anonymous 60.
  if (limit <= 60) return `Token was not accepted — still on the anonymous limit (${quota}).`;
  return `GitHub token is valid — ${quota}.`;
}
