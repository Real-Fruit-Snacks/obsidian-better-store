import { describe, it, expect } from "vitest";
import { summarizeTokenCheck } from "../src/data/token";

const body = (limit: number, remaining: number): string =>
  JSON.stringify({ resources: { core: { limit, remaining } } });

describe("summarizeTokenCheck", () => {
  it("reports an invalid or expired token on 401", () => {
    expect(summarizeTokenCheck(true, 401, "")).toBe("GitHub token is invalid or expired.");
  });

  it("reports other HTTP errors with the status", () => {
    expect(summarizeTokenCheck(true, 503, "")).toContain("HTTP 503");
  });

  it("confirms a valid token with the raised quota", () => {
    const msg = summarizeTokenCheck(true, 200, body(5000, 4987));
    expect(msg).toContain("valid");
    expect(msg).toContain("4,987 of 5,000");
  });

  it("flags a token that was silently ignored (still anonymous limit)", () => {
    expect(summarizeTokenCheck(true, 200, body(60, 58))).toContain("not accepted");
  });

  it("describes the anonymous baseline when no token is set", () => {
    const msg = summarizeTokenCheck(false, 200, body(60, 60));
    expect(msg).toContain("No token set");
    expect(msg).toContain("60 of 60");
  });

  it("falls back to the legacy top-level rate object", () => {
    const msg = summarizeTokenCheck(true, 200, JSON.stringify({ rate: { limit: 5000, remaining: 12 } }));
    expect(msg).toContain("12 of 5,000");
  });

  it("handles an unreadable body without throwing", () => {
    expect(summarizeTokenCheck(true, 200, "not json")).toContain("could not be read");
    expect(summarizeTokenCheck(true, 200, "{}")).toContain("could not be read");
  });
});
