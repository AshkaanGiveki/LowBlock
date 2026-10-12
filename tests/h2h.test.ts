import { describe, expect, it } from "vitest";
import ratings from "@/data/h2h-team-ratings-review.json";
import { buildH2HPairings, buildH2HSlates, getH2HWeek, scoreH2HFixture } from "@/lib/domain/h2h";

const home = ratings.teams[0];
const away = ratings.teams[1];
const fixture = (index: number, day: number) => ({
  providerMatchId: `fixture-${index}`,
  leagueCode: "UCL",
  status: "SCHEDULED",
  kickoffAt: new Date(Date.UTC(2026, 9, 9 + day, 12 + (index % 5))).toISOString(),
  homeTeam: { centralTeamId: home.teamId, name: home.name },
  awayTeam: { centralTeamId: away.teamId, name: away.name },
});

describe("H2H schedule rules", () => {
  it("pairs each player with exactly one opponent per slate", () => {
    const players = ["ashkan", "kaka", "mahyar", "ramin"];
    expect(buildH2HPairings(players, 0)).toEqual([
      { playerA: "ashkan", playerB: "ramin" },
      { playerA: "kaka", playerB: "mahyar" },
    ]);
    expect(buildH2HPairings(players, 1)).toEqual([
      { playerA: "ashkan", playerB: "mahyar" },
      { playerA: "ramin", playerB: "kaka" },
    ]);
    expect(buildH2HPairings(players, 2)).toEqual([
      { playerA: "ashkan", playerB: "kaka" },
      { playerA: "mahyar", playerB: "ramin" },
    ]);
    const seeded = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const pairKeys = new Set(
      Array.from({ length: 7 }, (_, round) => buildH2HPairings(seeded, round))
        .flat()
        .map(({ playerA, playerB }) => [playerA, playerB].sort().join(":")),
    );
    expect(pairKeys).toHaveLength(28);
    expect(buildH2HPairings(seeded, 6)[0]).toEqual({ playerA: "1", playerB: "2" });
  });

  it("scores every competition when at least one team is rated", () => {
    expect(scoreH2HFixture(fixture(1, 0))).toBeGreaterThan(0);
    expect(scoreH2HFixture({ ...fixture(2, 0), leagueCode: "GB_FA" })).toBeGreaterThan(0);
    expect(scoreH2HFixture({
      ...fixture(3, 0),
      homeTeam: { centralTeamId: "unrated-home" },
      awayTeam: { centralTeamId: "unrated-away" },
    })).toBeNull();
  });

  it("creates seven slates with no duplicate fixture and four-or-five target", () => {
    const week = getH2HWeek(new Date(Date.UTC(2026, 9, 10)));
    const fixtures = Array.from({ length: 35 }, (_, index) => fixture(index, Math.floor(index / 5)));
    const slates = buildH2HSlates(fixtures, week);
    expect(slates).toHaveLength(7);
    expect(slates.every((slate) => slate.fixtures.length >= 4 && slate.fixtures.length <= 5)).toBe(true);
    expect(new Set(slates.flatMap((slate) => slate.fixtureIds)).size).toBe(35);
  });
});
