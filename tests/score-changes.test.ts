import { describe, expect, it } from "vitest";
import { hasScoredPredictionChanged, type ScoredPredictionComparable } from "@/lib/scoring/scoreChanges";

const row: ScoredPredictionComparable = {
  scoringVersion: 1,
  points: 10,
  category: "EXACT_SCORE",
  predictedHomeGoals: 2,
  predictedAwayGoals: 1,
  actualHomeGoals: 2,
  actualAwayGoals: 1,
  globalEligible: true,
  clubIdAtLock: "club-a",
  leagueCode: "GB1",
  seasonStartYear: 2026,
  matchday: 12,
  roundId: "GB1:2026:12",
  kickoffAt: new Date("2026-11-21T19:00:00Z"),
  predictionCreatedAt: new Date("2026-11-20T09:00:00Z"),
};

describe("scored prediction change detection", () => {
  it("skips genuinely unchanged score rows", () => {
    expect(hasScoredPredictionChanged(row, { ...row })).toBe(false);
    expect(hasScoredPredictionChanged(row, {
      ...row, kickoffAt: "2026-11-21T19:00:00Z",
    })).toBe(false);
  });
  it("always writes first-time scores", () => {
    expect(hasScoredPredictionChanged(null, row)).toBe(true);
  });
  it.each([
    ["points", { points: 7 }],
    ["predicted result", { predictedHomeGoals: 1 }],
    ["final score", { actualAwayGoals: 2 }],
    ["global inclusion", { globalEligible: false }],
    ["club snapshot", { clubIdAtLock: "club-b" }],
    ["competition", { leagueCode: "GB_FA" }],
    ["season", { seasonStartYear: 2027 }],
    ["round", { roundId: "GB1:2026:13" }],
    ["matchday", { matchday: 13 }],
    ["kickoff time", { kickoffAt: new Date("2026-11-22T19:00:00Z") }],
    ["submitted time", { predictionCreatedAt: null }],
    ["score rules", { scoringVersion: 2 }],
    ["score category", { category: "CORRECT_OUTCOME" }],
  ])("detects changed %s", (_description, changed) => {
    expect(hasScoredPredictionChanged(row, { ...row, ...changed })).toBe(true);
  });
});
