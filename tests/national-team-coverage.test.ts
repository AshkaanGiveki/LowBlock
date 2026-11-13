import { describe, expect, it } from "vitest";
import { isImportantNationalTeam } from "@/lib/football/leagues";
import { normalizeSportsApiMatch } from "@/lib/football/sportsapi/normalizer";

const event = (uniqueTournamentId: number, home: string, away: string, national = true) => ({
  id: 17364420,
  startTimestamp: 1794585600,
  status: { code: 0, type: "notstarted", description: "Not started" },
  season: { year: "2026" },
  homeTeam: { id: 123, name: home, national, country: { name: home } },
  awayTeam: { id: 456, name: away, national, country: { name: away } },
  tournament: {
    uniqueTournament: {
      id: uniqueTournamentId,
      category: { name: uniqueTournamentId === 1848 ? "Africa" : "World" },
    },
  },
});

describe("important national-team fixture coverage", () => {
  it("keeps important AFCON qualifiers", () => {
    const match = normalizeSportsApiMatch(event(1848, "Nigeria", "Tanzania"));
    expect(match?.leagueCode).toBe("AFCONQ");
    expect(match?.featuredNationalFixture).toBe(true);
  });
  it("includes important senior national teams from unmapped competitions", () => {
    const match = normalizeSportsApiMatch(event(999100, "Germany", "Greece"));
    expect(match?.leagueCode).toBe("INTL_OTHER");
    expect(match?.featuredNationalFixture).toBe(true);
  });
  it("does not admit unmapped club fixtures", () => {
    expect(normalizeSportsApiMatch(event(999100, "Germany", "Greece", false))).toBeNull();
  });
  it("still excludes unimportant international fixtures", () => {
    expect(normalizeSportsApiMatch(event(1848, "Somalia", "Eritrea"))).toBeNull();
  });
  it("recognizes national-team name variants", () => {
    for (const name of ["Türkiye", "Côte d'Ivoire", "North Macedonia", "Korea Republic", "republic of ireland", "czechia"]) {
      expect(isImportantNationalTeam(name)).toBe(true);
    }
  });
});
