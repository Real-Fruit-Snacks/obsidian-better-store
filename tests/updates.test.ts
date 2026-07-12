import { describe, it, expect } from "vitest";
import {
  isMuted,
  isUpdateActionable,
  muteDeadline,
  muteRemaining,
  type UpdatePrefs,
} from "../src/data/updates";

const prefs = (over: Partial<UpdatePrefs> = {}): UpdatePrefs => ({
  ignored: [],
  skipped: {},
  muteUntil: 0,
  ...over,
});

describe("isUpdateActionable", () => {
  it("surfaces a normal update", () => {
    expect(isUpdateActionable("dataview", "1.2.0", prefs())).toBe(true);
  });

  it("suppresses updates for an ignored plugin", () => {
    expect(isUpdateActionable("dataview", "1.2.0", prefs({ ignored: ["dataview"] }))).toBe(false);
  });

  it("suppresses a skipped version and everything not newer than it", () => {
    const p = prefs({ skipped: { dataview: "1.2.0" } });
    expect(isUpdateActionable("dataview", "1.2.0", p)).toBe(false);
    expect(isUpdateActionable("dataview", "1.1.0", p)).toBe(false);
  });

  it("resurfaces once a newer version than the skipped one ships", () => {
    expect(isUpdateActionable("dataview", "1.3.0", prefs({ skipped: { dataview: "1.2.0" } }))).toBe(true);
  });
});

describe("mute", () => {
  it("is muted only until the deadline passes", () => {
    expect(isMuted(prefs({ muteUntil: 100 }), 50)).toBe(true);
    expect(isMuted(prefs({ muteUntil: 100 }), 100)).toBe(false);
    expect(isMuted(prefs({ muteUntil: 0 }), 50)).toBe(false);
  });

  it("computes a deadline from a duration", () => {
    expect(muteDeadline("1h", 1000)).toBe(1000 + 3_600_000);
    expect(muteDeadline("1w", 0)).toBe(7 * 24 * 3_600_000);
  });

  it("describes the remaining time, or null when not muted", () => {
    const now = 0;
    expect(muteRemaining(prefs({ muteUntil: 0 }), now)).toBeNull();
    expect(muteRemaining(prefs({ muteUntil: 5 * 3_600_000 }), now)).toBe("5h");
    expect(muteRemaining(prefs({ muteUntil: 25 * 3_600_000 }), now)).toBe("1d 1h");
    expect(muteRemaining(prefs({ muteUntil: 48 * 3_600_000 }), now)).toBe("2d");
  });
});
