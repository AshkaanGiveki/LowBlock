import { describe, expect, it } from "vitest";
import { calibrateH2HTeamRatings, H2H_STRENGTH_VERSION } from "@/lib/domain/h2hTeamStrength";
import { scoreH2HFixture, buildH2HDailySlate, getH2HWeek } from "@/lib/domain/h2h";

describe("evidence-based H2H strength", () => {
  const teams = [
    { centralTeamId: "a", currentLeagueCodes: ["GB1"], h2hRating: 85 },
    { centralTeamId: "b", currentLeagueCodes: ["GB1"], h2hRating: 55 },
    { centralTeamId: "c", currentLeagueCodes: ["GB2"] },
    { centralTeamId: "d", currentLeagueCodes: [] },
  ];
  const fixtures = Array.from({ length: 10 }, (_, n) => ({
    homeTeam: { centralTeamId: n % 2 ? "b" : "a" },
    awayTeam: { centralTeamId: "c" },
    leagueCode: n % 2 ? "GB_FA" : "GB1",
    kickoffAt: new Date(Date.UTC(2026, 9, n + 1)),
    status: "FINISHED",
    homeGoals: n % 2 ? 0 : 3,
    awayGoals: n % 2 ? 2 : 0,
  }));
  it("rates every team, including unrated and never-seen teams", () => {
    const ratings = calibrateH2HTeamRatings(teams, fixtures, new Date("2026-11-27T00:00:00Z"));
    expect(ratings).toHaveLength(4);
    expect(ratings.every(x => x.rating >= 35 && x.rating <= 95)).toBe(true);
    expect(ratings.every(x => x.confidence >= 0.2 && x.confidence <= 0.95)).toBe(true);
    expect(ratings.find(x => x.centralTeamId === "d")?.matchesUsed).toBe(0);
    expect(ratings.find(x => x.centralTeamId === "a")!.rating)
      .toBeGreaterThan(ratings.find(x => x.centralTeamId === "b")!.rating);
    expect(ratings.find(x => x.centralTeamId === "a")!.confidence)
      .toBeGreaterThan(ratings.find(x => x.centralTeamId === "d")!.confidence);
  });
  it("is idempotent and preserves the original weak curation prior", () => {
    const now=new Date("2026-11-27T00:00:00Z");
    const first=calibrateH2HTeamRatings(teams,fixtures,now);
    const rerated=teams.map(t=>({
      ...t,
      h2hRating:first.find(x=>x.centralTeamId===t.centralTeamId)!.rating,
      h2hRatingVersion:H2H_STRENGTH_VERSION,
      h2hLegacyRating:first.find(x=>x.centralTeamId===t.centralTeamId)!.legacyRating,
    }));
    expect(calibrateH2HTeamRatings(rerated,fixtures,now)).toEqual(first);
  });
  it("prefers two well-matched strong teams over a celebrity-versus-underdog pairing", () => {
    const make = (left:string,right:string) => ({
      leagueCode:"GB1",homeTeam:{centralTeamId:left},awayTeam:{centralTeamId:right},
    });
    const map=new Map([["elite",95],["unknown",40],["strongA",72],["strongB",71]]);
    expect(scoreH2HFixture(make("strongA","strongB"),map))
      .toBeGreaterThan(scoreH2HFixture(make("elite","unknown"),map)!);
  });
  it("assigns nonzero strength even without any curated ratings", () => {
    const m={leagueCode:"IT1",homeTeam:{centralTeamId:"new1"},awayTeam:{centralTeamId:"new2"}};
    expect(scoreH2HFixture(m,new Map())).toBeGreaterThan(0);
  });
});
