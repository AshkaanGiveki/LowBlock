import { describe, expect, it } from "vitest";
import { parseProviderStandings } from "@/lib/football/intelligence/standings";

const row = (position: number) => ({
  position,
  team: { id: 100 + position, name: "Team " + position, logo: null },
  matchesPlayed: 12,
  wins: 7,
  draws: 2,
  losses: 3,
  points: 23 - position,
  scoresFor: 20,
  scoresAgainst: 10,
});

describe("official football standings validation", () => {
  it("parses provider group rows without recalculating ranks", () => {
    const parsed = parseProviderStandings({
      success: true,
      data: { standings: [{ type: "total", rows: [row(2), row(1), row(3), row(4)] }] },
    });
    expect(parsed?.map((item) => item.rank)).toEqual([1, 2, 3, 4]);
    expect(parsed?.[0].team.name).toBe("Team 1");
    expect(parsed?.[0].played).toBe(12);
  });

  it("fails closed on duplicated team IDs and incomplete tables", () => {
    expect(parseProviderStandings({ data: { standings: [row(1), row(1), row(3), row(4)] } })).toBeNull();
    expect(parseProviderStandings({ data: { standings: [row(1)] } })).toBeNull();
  });

  it("rejects error responses and missing scores rather than inventing points", () => {
    expect(parseProviderStandings({ success: false, error: { code: 429 } })).toBeNull();
    const incomplete = { ...row(1), points: undefined };
    expect(parseProviderStandings({ data: { standings: [incomplete, row(2), row(3), row(4)] } })).toBeNull();
  });
});
