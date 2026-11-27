import { describe, expect, it } from "vitest";
import { shouldRunH2HPublication } from "@/lib/worker/h2hPublishSchedule";

describe("SuperLeague worker publication timing", () => {
  const base = {
    nowMs: Date.parse("2026-11-27T08:29:30Z"),
    currentWeekKey: "2026-11-20",
    lastAttemptAt: Date.parse("2026-11-27T08:29:00Z"),
    lastSuccessfulWeekKey: "2026-11-20",
    lastAttemptFailed: false,
  };
  it("runs at worker startup and when the Friday noon H2H week rolls over", () => {
    expect(shouldRunH2HPublication({ ...base, lastAttemptAt: 0 })).toBe(true);
    expect(shouldRunH2HPublication({
      ...base, nowMs: Date.parse("2026-11-27T08:31:00Z"),
      currentWeekKey: "2026-11-27",
    })).toBe(true);
  });
  it("does not flood the database during the same week", () => {
    expect(shouldRunH2HPublication(base)).toBe(false);
    expect(shouldRunH2HPublication({
      ...base, nowMs: base.lastAttemptAt + 14 * 60_000,
    })).toBe(false);
    expect(shouldRunH2HPublication({
      ...base, nowMs: base.lastAttemptAt + 15 * 60_000,
    })).toBe(true);
  });
  it("retries a failed publication after five minutes, not after an hour", () => {
    expect(shouldRunH2HPublication({
      ...base, lastAttemptFailed: true,
      nowMs: base.lastAttemptAt + 4 * 60_000,
    })).toBe(false);
    expect(shouldRunH2HPublication({
      ...base, lastAttemptFailed: true,
      nowMs: base.lastAttemptAt + 5 * 60_000,
    })).toBe(true);
  });
});
