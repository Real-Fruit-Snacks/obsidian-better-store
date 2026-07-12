import { describe, it, expect } from "vitest";
import { resolveLegacySecret, summarizeTokenCheck } from "../src/data/token";

const body = (limit: number, remaining: number): string =>
  JSON.stringify({ resources: { core: { limit, remaining } } });

describe("summarizeTokenCheck", () => {
  it("reports an invalid or expired token on 401", () => {
    expect(summarizeTokenCheck(true, 401, "")).toEqual({
      valid: false,
      message: "GitHub token is invalid or expired.",
    });
  });

  it("reports other HTTP errors with the status", () => {
    const check = summarizeTokenCheck(true, 503, "");
    expect(check.valid).toBe(false);
    expect(check.message).toContain("HTTP 503");
  });

  it("confirms a valid token with the raised quota", () => {
    const check = summarizeTokenCheck(true, 200, body(5000, 4987));
    expect(check.valid).toBe(true);
    expect(check.message).toContain("valid");
    expect(check.message).toContain("4,987 of 5,000");
  });

  it("flags a token that was silently ignored (still anonymous limit)", () => {
    const check = summarizeTokenCheck(true, 200, body(60, 58));
    expect(check.valid).toBe(false);
    expect(check.message).toContain("not accepted");
  });

  it("describes the anonymous baseline when no token is set", () => {
    const check = summarizeTokenCheck(false, 200, body(60, 60));
    expect(check.valid).toBe(false);
    expect(check.message).toContain("No token set");
    expect(check.message).toContain("60 of 60");
  });

  it("falls back to the legacy top-level rate object", () => {
    const check = summarizeTokenCheck(true, 200, JSON.stringify({ rate: { limit: 5000, remaining: 12 } }));
    expect(check.valid).toBe(true);
    expect(check.message).toContain("12 of 5,000");
  });

  it("handles an unreadable body without throwing", () => {
    expect(summarizeTokenCheck(true, 200, "not json").message).toContain("could not be read");
    expect(summarizeTokenCheck(true, 200, "{}").message).toContain("could not be read");
  });
});

describe("resolveLegacySecret", () => {
  const LEGACY = "better-store-github-token";

  it("does nothing when the legacy secret is missing or empty", () => {
    expect(resolveLegacySecret(null, LEGACY, ["betterstore"])).toEqual({ secretId: "", scrubLegacy: false });
    expect(resolveLegacySecret("", LEGACY, ["betterstore"])).toEqual({ secretId: "", scrubLegacy: false });
  });

  it("re-links to the named secret when the bug stored a secret name as the token", () => {
    expect(resolveLegacySecret("betterstore", LEGACY, [LEGACY, "betterstore"])).toEqual({
      secretId: "betterstore",
      scrubLegacy: true,
    });
  });

  it("unlinks a self-referential legacy secret", () => {
    expect(resolveLegacySecret(LEGACY, LEGACY, [LEGACY])).toEqual({ secretId: "", scrubLegacy: true });
  });

  it("keeps a real migrated token in the legacy secret", () => {
    expect(resolveLegacySecret("ghp_abc123XYZ", LEGACY, [LEGACY, "betterstore"])).toEqual({
      secretId: LEGACY,
      scrubLegacy: false,
    });
  });

  it("treats a value that only looks like an id but matches no secret as a real token", () => {
    expect(resolveLegacySecret("some-old-token", LEGACY, [LEGACY])).toEqual({
      secretId: LEGACY,
      scrubLegacy: false,
    });
  });
});
