import { describe, expect, it } from "vitest";
import { normalizeSportsApiMatch, normalizeSportsApiIncident } from "@/lib/football/sportsapi/normalizer";
import { getLeagueCodeFromSportsApi } from "@/lib/football/competitionMapping";

describe("SportsAPIPro Tournament Ingestion & Normalizer", () => {
  it("normalizes live matches with 2nd half +45 minute elapsed calculation", () => {
    const rawSecondHalfEvent = {
      id: 123456,
      tournament: {
        uniqueTournament: { id: 17, name: "Premier League" },
        category: { name: "England" },
      },
      season: { year: "2026/2027" },
      roundInfo: { round: 5 },
      startTimestamp: 1727790000,
      homeTeam: { id: 44, name: "Liverpool" },
      awayTeam: { id: 14, name: "Chelsea" },
      homeScore: { current: 2, display: 2, period1: 1, period2: 1 },
      awayScore: { current: 1, display: 1, period1: 0, period2: 1 },
      status: { code: 7, description: "2nd half", type: "inprogress" },
      time: {
        // 10 minutes into 2nd half
        currentPeriodStartTimestamp: Math.floor(Date.now() / 1000) - 10 * 60,
      },
    };

    const match = normalizeSportsApiMatch(rawSecondHalfEvent);
    expect(match).not.toBeNull();
    expect(match?.status).toBe("LIVE");
    expect(match?.elapsed).toBeGreaterThanOrEqual(54);
    expect(match?.elapsed).toBeLessThanOrEqual(56);
    expect(match?.homeTeam.logoUrl).toBeDefined();
    expect(match?.awayTeam.logoUrl).toBeDefined();
  });

  it("accurately parses Halftime status and fixes elapsed to 45", () => {
    const rawHtEvent = {
      id: 123457,
      tournament: {
        uniqueTournament: { id: 8, name: "LaLiga" },
        category: { name: "Spain" },
      },
      season: { year: "2026/2027" },
      roundInfo: { round: 8 },
      startTimestamp: 1727790000,
      homeTeam: { id: 2817, name: "Barcelona" },
      awayTeam: { id: 2829, name: "Real Madrid" },
      homeScore: { current: 1, display: 1, period1: 1 },
      awayScore: { current: 0, display: 0, period1: 0 },
      status: { code: 31, description: "Halftime", type: "inprogress" },
    };

    const match = normalizeSportsApiMatch(rawHtEvent);
    expect(match?.status).toBe("LIVE");
    expect(match?.elapsed).toBe(45);
  });

  it("does not falsely map Ukraine or other countries to England (GB1)", () => {
    const ukrainianMatch = {
      uniqueTournament: { id: 218, name: "Ukrainian Premier League" },
      tournament: { name: "Premier League" },
      category: { name: "Ukraine" },
    };

    const code = getLeagueCodeFromSportsApi(ukrainianMatch);
    expect(code).toBeNull();
  });

  it("correctly maps UEFA Nations League and FA Cup", () => {
    const nationsMatch = {
      uniqueTournament: { id: 10783, name: "UEFA Nations League" },
      category: { name: "Europe" },
    };
    expect(getLeagueCodeFromSportsApi(nationsMatch)).toBe("NATIONS");

    const faCupMatch = {
      uniqueTournament: { id: 19, name: "FA Cup" },
      category: { name: "England" },
    };
    expect(getLeagueCodeFromSportsApi(faCupMatch)).toBe("GB_FA");
  });

  it("normalizes rich incident attributes for commentary display", () => {
    const rawGoal = {
      id: 991,
      incidentType: "goal",
      incidentClass: "regular",
      time: 73,
      isHome: true,
      player: { name: "Mohamed Salah", id: 100 },
      assist1: { name: "Trent Alexander-Arnold", id: 101 },
      homeScore: 2,
      awayScore: 1,
    };

    const inc = normalizeSportsApiIncident(rawGoal);
    expect(inc).not.toBeNull();
    expect(inc?.type).toBe("goal");
    expect(inc?.time).toBe(73);
    expect(inc?.playerName).toBe("Mohamed Salah");
    expect(inc?.score).toEqual({ home: 2, away: 1 });
  });
});
