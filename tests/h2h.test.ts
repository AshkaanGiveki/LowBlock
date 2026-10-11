import { describe, expect, it } from "vitest";
import ratings from "@/data/h2h-team-ratings-review.json";
import { buildH2HSlates, getH2HWeek, scoreH2HFixture } from "@/lib/domain/h2h";

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
  it("scores only approved fixtures using reviewed ratings", () => {
    expect(scoreH2HFixture(fixture(1, 0))).toBeGreaterThan(0);
    expect(scoreH2HFixture({ ...fixture(2, 0), leagueCode: "GB_FA" })).toBeNull();
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
