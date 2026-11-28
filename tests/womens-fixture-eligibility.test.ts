import { describe, expect, it } from "vitest";
import {
  isWomensFootballFixture,
  isSupportedMensFootballFixture,
  isNotifiableFootballFixture,
} from "@/lib/football/fixtureEligibility";
import { normalizeSportsApiMatch } from "@/lib/football/sportsapi/normalizer";

const base = {
  id: 17592975,
  startTimestamp: Date.parse("2026-11-14T20:00:00Z") / 1000,
  tournament: {
    name: "International Friendly Games Women",
    slug: "international-friendly-games-women",
    category: { name: "World" },
    uniqueTournament: {
      id: 999111, name: "International Friendly Games Women",
      slug: "int-friendly-games-women", category: { name: "World" },
    },
  },
  homeTeam: { id: 172, name: "France", national: true, gender: "F" },
  awayTeam: { id: 284, name: "Venezuela", national: true, gender: "F" },
  status: { type: "notstarted" },
};
describe("women's fixture exclusions across the app", () => {
  it("recognizes the exact women's national-team metadata found in production", () => {
    expect(isWomensFootballFixture(base)).toBe(true);
    expect(isWomensFootballFixture({ rawApiResponse: base })).toBe(true);
    expect(normalizeSportsApiMatch(base)).toBeNull();
    expect(normalizeSportsApiMatch({ event: base })).toBeNull();
  });
  it("rejects explicit female team gender even under a men's mapped competition", () => {
    const event = {
      ...base,
      tournament: { uniqueTournament: { id: 10783, name: "UEFA Nations League" }, category: { name: "Europe" } },
      homeTeam: { ...base.homeTeam, gender: "F" },
      awayTeam: { ...base.awayTeam, gender: "F" },
    };
    expect(normalizeSportsApiMatch(event)).toBeNull();
  });
  it("rejects a female-specific competition name or slug without team gender", () => {
    const event = {
      ...base,
      homeTeam: { id: 1, name: "France", national: true },
      awayTeam: { id: 2, name: "Venezuela", national: true },
    };
    expect(isWomensFootballFixture(event)).toBe(true);
    expect(normalizeSportsApiMatch(event)).toBeNull();
  });
  it("keeps legitimate male international football and country names", () => {
    const event = {
      ...base,
      tournament: { uniqueTournament: { id: 10783, name: "UEFA Nations League" }, category: { name: "Europe" } },
      homeTeam: { id: 3, name: "Wales", national: true, gender: "M" },
      awayTeam: { id: 4, name: "New Zealand", national: true, gender: "M" },
    };
    expect(isWomensFootballFixture(event)).toBe(false);
    expect(normalizeSportsApiMatch(event)).not.toBeNull();
  });
  it("prevents already queued Telegram and channel alerts for excluded fixtures", () => {
    const match = {
      providerMatchId: String(base.id), leagueCode: "NATIONS",
      kickoffAt: new Date("2026-11-14T20:00:00Z"),
      rawApiResponse: base,
    };
    expect(isSupportedMensFootballFixture(match)).toBe(false);
    expect(isNotifiableFootballFixture(match)).toBe(false);
  });
  it("allows valid men's fixtures and blocks off-window unmapped international alerts", () => {
    const date = new Date("2026-11-14T20:00:00Z");
    const allowed = {
      providerMatchId: "1", leagueCode: "NATIONS", kickoffAt: date,
      rawApiResponse: { ...base, homeTeam: { gender: "M", name: "Wales" },
        awayTeam: { gender: "M", name: "England" },
        tournament: { name: "UEFA Nations League" } },
    };
    expect(isNotifiableFootballFixture(allowed)).toBe(true);
    expect(isNotifiableFootballFixture({
      ...allowed, leagueCode: "INTL_OTHER", kickoffAt: new Date("2026-11-28T19:00:00Z"),
    })).toBe(false);
  });
});
