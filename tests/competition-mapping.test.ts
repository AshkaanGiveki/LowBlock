import { describe, expect, it } from "vitest";
import {
  getLeagueCodeFromSportsApi,
  getSportsApiUniqueTournamentId,
  getApiSportsId,
  isSupportedSportsApiTournament,
  COMPETITION_MAPPINGS,
} from "@/lib/football/competitionMapping";
import { getLeague } from "@/lib/football/leagues";

describe("competition mapping", () => {
  it("resolves Premier League by uniqueTournament.id", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { id: 17, name: "Premier League" },
    });
    expect(code).toBe("GB1");
  });

  it("resolves La Liga by uniqueTournament.id", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { id: 8, name: "LaLiga" },
    });
    expect(code).toBe("ES1");
  });

  it("resolves Bundesliga by uniqueTournament.id", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { id: 35, name: "Bundesliga" },
    });
    expect(code).toBe("L1");
  });

  it("resolves Serie A by uniqueTournament.id", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { id: 23, name: "Serie A" },
    });
    expect(code).toBe("IT1");
  });

  it("resolves Ligue 1 by uniqueTournament.id", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { id: 34, name: "Ligue 1" },
    });
    expect(code).toBe("FR1");
  });

  it("resolves Champions League by uniqueTournament.id", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { id: 7, name: "UEFA Champions League" },
    });
    expect(code).toBe("UCL");
  });

  it("resolves Europa League by uniqueTournament.id", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { id: 679, name: "UEFA Europa League" },
    });
    expect(code).toBe("UEL");
  });

  it("resolves tournament by slug fallback", () => {
    const code = getLeagueCodeFromSportsApi({
      slug: "championship",
      name: "Championship",
    });
    expect(code).toBe("GB2");
  });

  it("resolves tournament by uniqueTournament slug fallback", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { slug: "saudi-pro-league" },
    });
    expect(code).toBe("SA1");
  });

  it("resolves tournament by alias fallback", () => {
    const code = getLeagueCodeFromSportsApi({
      name: "FA Cup",
    });
    expect(code).toBe("GB_FA");
  });

  it("returns null for unsupported competition", () => {
    const code = getLeagueCodeFromSportsApi({
      uniqueTournament: { id: 999999, name: "Unknown Regional Cup" },
      slug: "unknown-regional-cup",
    });
    expect(code).toBeNull();
    expect(
      isSupportedSportsApiTournament({
        uniqueTournament: { id: 999999 },
      }),
    ).toBe(false);
  });

  it("maps internal code to SportsAPI uniqueTournamentId", () => {
    expect(getSportsApiUniqueTournamentId("GB1")).toBe(17);
    expect(getSportsApiUniqueTournamentId("ES1")).toBe(8);
    expect(getSportsApiUniqueTournamentId("UCL")).toBe(7);
    expect(getSportsApiUniqueTournamentId("NON_EXISTENT")).toBeNull();
  });

  it("maps internal code to API-Sports id", () => {
    expect(getApiSportsId("GB1")).toBe(39);
    expect(getApiSportsId("ES1")).toBe(140);
    expect(getApiSportsId("UCL")).toBe(2);
    expect(getApiSportsId("NON_EXISTENT")).toBeNull();
  });

  it("has bidirectional mappings for all configured competitions", () => {
    const codes = new Set<string>();
    const sportsApiIds = new Set<number>();
    const apiSportsIds = new Set<number>();
    for (const entry of COMPETITION_MAPPINGS) {
      expect(entry.code).toBeTruthy();
      expect(getLeague(entry.code)).toBeTruthy();
      expect(entry.apiSportsId).toBeGreaterThan(0);
      expect(entry.sportsApiUniqueTournamentId).toBeGreaterThan(0);
      expect(codes.has(entry.code)).toBe(false);
      expect(sportsApiIds.has(entry.sportsApiUniqueTournamentId)).toBe(false);
      expect(apiSportsIds.has(entry.apiSportsId)).toBe(false);
      codes.add(entry.code);
      sportsApiIds.add(entry.sportsApiUniqueTournamentId);
      apiSportsIds.add(entry.apiSportsId);
      expect(getSportsApiUniqueTournamentId(entry.code)).toBe(
        entry.sportsApiUniqueTournamentId,
      );
      expect(getApiSportsId(entry.code)).toBe(entry.apiSportsId);
    }
  });
});
