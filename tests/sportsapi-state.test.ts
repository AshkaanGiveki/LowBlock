import { describe, expect, it } from "vitest";
import { applyDeltaUpdate } from "@/lib/football/sportsapi/state";
import type { CanonicalMatch } from "@/lib/football/types";

describe("sportsapi state reconciliation", () => {
  const baseMatch: CanonicalMatch = {
    provider: "sportsapi",
    providerMatchId: "1001",
    leagueCode: "GB1",
    matchday: 5,
    seasonStartYear: 2024,
    roundId: "GB1:2024:5",
    homeTeamProviderId: "1",
    awayTeamProviderId: "2",
    homeTeam: { id: 1, name: "Arsenal", logoUrl: null },
    awayTeam: { id: 2, name: "Tottenham", logoUrl: null },
    kickoffAt: new Date("2024-09-15T13:00:00Z"),
    status: "SCHEDULED",
    elapsed: null,
    homeGoals: null,
    awayGoals: null,
    availability: {
      score: { available: true, source: "rest" },
      incidents: { available: false },
      stats: { available: false },
      odds: { available: false },
      lineups: { available: false },
    },
    lastChangeTimestamp: 1000,
  };

  it("merges partial score and elapsed updates cleanly without losing match properties", () => {
    const delta = {
      changes: { changeTimestamp: 1050 },
      status: { type: "inprogress" },
      homeScore: { current: 1, display: 1 },
      awayScore: { current: 0, display: 0 },
      time: { currentPeriodStartTimestamp: Math.floor(Date.now() / 1000) - 1200 },
    };

    const updated = applyDeltaUpdate(baseMatch, delta);
    expect(updated.status).toBe("LIVE");
    expect(updated.homeGoals).toBe(1);
    expect(updated.awayGoals).toBe(0);
    expect(updated.elapsed).toBe(20);
    expect(updated.homeTeam.name).toBe("Arsenal");
    expect(updated.awayTeam.name).toBe("Tottenham");
    expect(updated.lastChangeTimestamp).toBe(1050);
  });

  it("ignores older deltas using changes.changeTimestamp deduplication", () => {
    const olderDelta = {
      changes: { changeTimestamp: 950 },
      homeScore: { current: 5, display: 5 },
    };

    const result = applyDeltaUpdate(baseMatch, olderDelta);
    expect(result).toBe(baseMatch); // Unchanged reference
    expect(result.homeGoals).toBeNull();
  });

  it("handles status transitions to FINISHED and preserves score", () => {
    const deltaFinished = {
      changes: { changeTimestamp: 1200 },
      status: { type: "finished" },
      homeScore: { current: 2, display: 2, normaltime: 2 },
      awayScore: { current: 1, display: 1, normaltime: 1 },
    };

    const updated = applyDeltaUpdate(baseMatch, deltaFinished);
    expect(updated.status).toBe("FINISHED");
    expect(updated.homeGoals).toBe(2);
    expect(updated.awayGoals).toBe(1);
  });
});
