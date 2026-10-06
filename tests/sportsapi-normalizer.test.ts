import { describe, expect, it } from "vitest";
import {
  normalizeSportsApiMatch,
  normalizeSportsApiIncident,
} from "@/lib/football/sportsapi/normalizer";

describe("sportsapi normalizer", () => {
  const sampleRawEvent = {
    id: 17166285,
    startTimestamp: 1727788800,
    status: {
      code: 6,
      description: "Inprogress",
      type: "inprogress",
    },
    tournament: {
      id: 52,
      name: "Premier League",
      slug: "premier-league",
      uniqueTournament: {
        id: 17,
        name: "Premier League",
        slug: "premier-league",
      },
    },
    season: {
      id: 61627,
      name: "Premier League 24/25",
      year: "24/25",
    },
    roundInfo: {
      round: 6,
    },
    homeTeam: {
      id: 44,
      name: "Liverpool",
      shortName: "LIV",
      nameCode: "LIV",
    },
    awayTeam: {
      id: 14,
      name: "Chelsea",
      shortName: "CHE",
      nameCode: "CHE",
    },
    homeScore: {
      current: 2,
      display: 2,
      period1: 1,
      period2: 1,
      normaltime: 2,
    },
    awayScore: {
      current: 1,
      display: 1,
      period1: 0,
      period2: 1,
      normaltime: 1,
    },
    changes: {
      changeTimestamp: 1727792400,
    },
  };

  it("normalizes a raw SportsAPI event into a CanonicalMatch", () => {
    const match = normalizeSportsApiMatch(sampleRawEvent);
    expect(match).not.toBeNull();
    if (!match) return;

    expect(match.provider).toBe("sportsapi");
    expect(match.providerMatchId).toBe("17166285");
    expect(match.sportsApiId).toBe(17166285);
    expect(match.leagueCode).toBe("GB1");
    expect(match.matchday).toBe(6);
    expect(match.seasonStartYear).toBe(2024);
    expect(match.roundId).toBe("GB1:2024:6");
    expect(match.homeTeam.id).toBe(44);
    expect(match.homeTeam.name).toBe("Liverpool");
    expect(match.awayTeam.id).toBe(14);
    expect(match.awayTeam.name).toBe("Chelsea");
    expect(match.status).toBe("LIVE");
    expect(match.homeGoals).toBe(2);
    expect(match.awayGoals).toBe(1);
    expect(match.homeScore?.period1).toBe(1);
    expect(match.availability.score.available).toBe(true);
    expect(match.availability.stats.available).toBe(false);
    expect(match.availability.odds.available).toBe(false);
  });

  it("returns null if competition is not mapped", () => {
    const unmappedEvent = {
      ...sampleRawEvent,
      tournament: {
        id: 99999,
        uniqueTournament: { id: 99999, name: "Unmapped Sunday League" },
      },
    };
    expect(normalizeSportsApiMatch(unmappedEvent)).toBeNull();
  });

  it("filters international fixtures unless one side is an important national team", () => {
    const base = {
      ...sampleRawEvent,
      tournament: {
        uniqueTournament: { id: 10783, name: "UEFA Nations League" },
        category: { name: "Europe" },
      },
      homeTeam: { id: 1, name: "Luxembourg" },
      awayTeam: { id: 2, name: "Faroe Islands" },
    };
    expect(normalizeSportsApiMatch(base)).toBeNull();
    expect(
      normalizeSportsApiMatch({
        ...base,
        homeTeam: { id: 3, name: "Türkiye" },
      }),
    ).not.toBeNull();
  });

  it("normalizes various match statuses accurately", () => {
    const testCases = [
      { status: { type: "finished" }, expected: "FINISHED" },
      { status: { type: "inprogress" }, expected: "LIVE" },
      { status: { type: "notstarted" }, expected: "SCHEDULED" },
      { status: { type: "postponed" }, expected: "POSTPONED" },
      { status: { description: "POSTPONED" }, expected: "POSTPONED" },
      { status: { type: "canceled" }, expected: "VOID" },
      { status: { description: "CANCELLED" }, expected: "VOID" },
      { status: { type: "suspended" }, expected: "SUSPENDED" },
    ];

    for (const { status, expected } of testCases) {
      const match = normalizeSportsApiMatch({ ...sampleRawEvent, status });
      expect(match?.status).toBe(expected);
    }
  });

  it("normalizes incidents properly", () => {
    const rawGoal = {
      id: 101,
      incidentType: "goal",
      time: 23,
      player: { name: "Mohamed Salah" },
      homeScore: 1,
      awayScore: 0,
      incidentClass: "regular",
    };
    const goal = normalizeSportsApiIncident(rawGoal);
    expect(goal).toMatchObject({
      id: "101",
      type: "goal",
      time: 23,
      playerName: "Mohamed Salah",
      score: { home: 1, away: 0 },
    });

    const rawYellowCard = {
      id: 102,
      incidentType: "card",
      time: 42,
      player: { name: "Enzo Fernández" },
      incidentClass: "yellow",
    };
    const card = normalizeSportsApiIncident(rawYellowCard);
    expect(card).toMatchObject({
      id: "102",
      type: "card",
      time: 42,
      playerName: "Enzo Fernández",
      cardType: "yellow",
    });

    const rawSub = {
      id: 103,
      incidentType: "substitution",
      time: 65,
      playerIn: { name: "Darwin Núñez" },
      playerOut: { name: "Diogo Jota" },
    };
    const sub = normalizeSportsApiIncident(rawSub);
    expect(sub).toMatchObject({
      id: "103",
      type: "substitution",
      time: 65,
      playerInName: "Darwin Núñez",
      playerOutName: "Diogo Jota",
    });
  });
});
