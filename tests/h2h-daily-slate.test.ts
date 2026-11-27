import { afterEach, describe, expect, it, vi } from "vitest";
import { buildH2HDailySlate, getH2HWeek } from "@/lib/domain/h2h";

const game = (id: number, start = "2026-11-27T19:30:00Z") => ({
  providerMatchId: String(8000 + id),
  leagueCode: "GB1",
  status: "SCHEDULED",
  kickoffAt: new Date(start),
  homeTeam: { centralTeamId: "home" },
  awayTeam: { centralTeamId: "away" },
});
const rated = new Map([["home", 72], ["away", 71]]);

describe("safe Super League daily slate publication", () => {
  afterEach(() => vi.useRealTimers());

  it("uses Friday noon Tehran for the fifth weekly league rollover", () => {
    expect(getH2HWeek(new Date("2026-11-27T08:29:59Z")).key).toBe("2026-11-20");
    expect(getH2HWeek(new Date("2026-11-27T08:30:01Z")).key).toBe("2026-11-27");
  });

  it("does not lock a short slate while the provider has only two fixtures", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T09:00:00Z"));
    expect(buildH2HDailySlate([game(1), game(2)], getH2HWeek(), "2026-11-27", rated))
      .toBeNull();
  });

  it("publishes exactly five supported, visible, upcoming fixtures", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T09:00:00Z"));
    const fixtures = Array.from({ length: 7 }, (_, index) => game(index));
    const slate = buildH2HDailySlate(fixtures, getH2HWeek(), "2026-11-27", rated);
    expect(slate?.fixtureIds).toHaveLength(5);
    expect(slate?.matchday).toBe(1);
    expect(new Set(slate!.fixtureIds).size).toBe(5);
  });

  it("does not prepublish Saturday afternoon fixtures before they appear on the matches page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T09:00:00Z"));
    const fixtures = Array.from({ length: 5 }, (_, index) =>
      game(index,"2026-11-28T15:00:00Z"));
    expect(buildH2HDailySlate(fixtures, getH2HWeek(), "2026-11-28", rated))
      .toBeNull();
  });

  it("rejects terminal, duplicate and unsupported games", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T09:00:00Z"));
    const fixtures = [
      game(1),game(2),game(3),
      {...game(4),duplicateOf:"original"},
      {...game(5),status:"FINISHED"},
      {...game(6),leagueCode:"SA1"},
    ];
    expect(buildH2HDailySlate(fixtures, getH2HWeek(), "2026-11-27", rated))
      .toBeNull();
  });
});
