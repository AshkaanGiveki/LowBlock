import { describe, expect, it } from "vitest";
import {
  parseSportsApiPregameForm,
  parseSportsApiDuel,
  parseSportsApiTeamLast,
} from "@/lib/football/intelligence/providerHistory";

const cutoff = new Date("2026-11-16T16:00:00.000Z");
const event = (id: number, home: number, away: number, homeScore: number, awayScore: number, at = 1794758400) => ({
  id, startTimestamp: at,
  status: { type: "finished", code: 100 },
  homeTeam: { id: home, name: "Team " + home },
  awayTeam: { id: away, name: "Team " + away },
  homeScore: { current: homeScore },
  awayScore: { current: awayScore },
});
describe("SportsAPI provider-first history parser", () => {
  it("reads the documented pre-match form without fabricating missing five results", () => {
    const value = parseSportsApiPregameForm({
      success: true,
      data: {
        homeTeam: { form: ["D", "L"], position: 16 },
        awayTeam: { form: ["L", "L"], position: 13 },
      },
    });
    expect(value).toEqual({
      home: { results: ["D", "L"], position: 16 },
      away: { results: ["L", "L"], position: 13 },
    });
    expect(parseSportsApiPregameForm({ success: false, data: {} })).toBeNull();
    expect(parseSportsApiPregameForm({ data: { homeTeam: { form: ["W"] } } })).toBeNull();
  });

  it("parses team H2H totals but never invents individual historical fixtures", () => {
    expect(parseSportsApiDuel({
      success: true, data: { teamDuel: { homeWins: 1, draws: 2, awayWins: 3 } },
    })).toEqual({ homeWins: 1, draws: 2, awayWins: 3 });
    expect(parseSportsApiDuel({ data: { teamDuel: { homeWins: -1, draws: 0, awayWins: 0 } } })).toBeNull();
    expect(parseSportsApiDuel({ error: { code: 404 } })).toBeNull();
  });

  it("uses only verified completed results involving exactly the requested team before the fixture", () => {
    const sample = { success: true, data: { events: [
      event(1, 5, 7, 2, 1),
      event(2, 8, 5, 1, 1),
      event(3, 8, 9, 3, 0),
      event(4, 5, 1, 2, 2, 1794830400),
      { ...event(5, 5, 6, 1, 0), status: { type: "inprogress" } },
      { ...event(6, 5, 6, 1, 0), homeScore: {} },
    ] } };
    const form = parseSportsApiTeamLast(sample, 5, cutoff);
    expect(form.map((x) => x.fixtureId)).toEqual(["1", "2"]);
    expect(form.map((x) => x.result)).toEqual(["W", "D"]);
    expect(form[0].venue).toBe("home");
    expect(form[1].venue).toBe("away");
    expect(parseSportsApiTeamLast({ success: false, data: { events: [event(1, 5, 7, 2, 1)] } }, 5, cutoff)).toEqual([]);
  });
});
