import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { buildLocalHistory, summarizeH2H, summarizeTeamForm } from "@/lib/football/intelligence/history";

const fixture = (id: string, homeId: number, awayId: number, homeGoals: number | null, awayGoals: number | null) => ({
  providerMatchId: id,
  provider: "sportsapi",
  status: "FINISHED",
  leagueCode: "EPL",
  kickoffAt: new Date("2026-10-10T15:00:00Z"),
  homeTeam: { id: homeId, name: "Team " + homeId },
  awayTeam: { id: awayId, name: "Team " + awayId },
  homeGoals,
  awayGoals,
});

describe("local Match Intelligence without provider requests", () => {
  it("computes the last-five W/D/L from the selected team's perspective", () => {
    const rows = [
      fixture("a", 1, 2, 2, 1),
      fixture("b", 3, 1, 2, 2),
      fixture("c", 3, 1, 1, 0),
      fixture("d", 1, 4, null, null),
    ];
    const form = summarizeTeamForm(rows, 1);
    expect(form.map((item) => item.result)).toEqual(["W", "D", "L"]);
    expect(form[1].venue).toBe("away");
    expect(form[1].goalsFor).toBe(2);
    expect(form[2].goalsAgainst).toBe(1);
  });

  it("excludes fixtures without verified final scores from team H2H", () => {
    const meetings = summarizeH2H([
      fixture("a", 1, 2, 1, 0),
      fixture("b", 2, 1, null, 0),
      fixture("c", 2, 1, 2, 2),
    ]);
    expect(meetings.map((item) => item.fixtureId)).toEqual(["a", "c"]);
  });

  it("uses provider-isolated, time-bounded, limited match queries", async () => {
    const rows = [fixture("a", 1, 2, 1, 0)];
    const toArray = vi.fn(async () => rows);
    const limit = vi.fn(() => ({ toArray }));
    const sort = vi.fn(() => ({ limit }));
    const find = vi.fn(() => ({ sort }));
    const db = { collection: vi.fn(() => ({ find })) } as unknown as Db;
    const match = {
      ...fixture("upcoming", 1, 2, null, null),
      kickoffAt: new Date("2026-11-15T12:00:00Z"),
      status: "SCHEDULED",
    };
    const result = await buildLocalHistory(db, match);
    expect(find).toHaveBeenCalledTimes(3);
    for (const [query] of find.mock.calls) {
      expect(query).toMatchObject({
        provider: "sportsapi",
        status: "FINISHED",
        kickoffAt: { $lt: match.kickoffAt },
      });
    }
    expect(limit).toHaveBeenCalledWith(30);
    expect(result.form.home[0]?.result).toBe("W");
    expect(result.coverage).toBe("partial-imported-fixtures");
  });

  it("does not issue queries for missing provider team identifiers", async () => {
    const db = { collection: vi.fn() } as unknown as Db;
    const result = await buildLocalHistory(db, fixture("bad", 0, 1, null, null));
    expect(db.collection).not.toHaveBeenCalled();
    expect(result.h2h).toEqual([]);
  });
});
