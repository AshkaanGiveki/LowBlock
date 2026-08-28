import { describe, expect, it } from "vitest";
import { getIranWeeklyPeriod } from "@/lib/domain/leaderboardPeriods";

describe("Iran weekly leaderboard period", () => {
  it("starts exactly at Friday 03:30 Iran time", () => {
    const period = getIranWeeklyPeriod(new Date("2026-08-28T00:00:00.000Z"));
    expect(period.start.toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-09-04T00:00:00.000Z");
  });

  it("keeps 03:29:59 in the previous week", () => {
    const period = getIranWeeklyPeriod(new Date("2026-08-27T23:59:59.999Z"));
    expect(period.start.toISOString()).toBe("2026-08-21T00:00:00.000Z");
    expect(new Date("2026-08-27T23:59:59.999Z").getTime()).toBeLessThan(period.end.getTime());
  });
});
