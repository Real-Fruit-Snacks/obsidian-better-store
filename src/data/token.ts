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
