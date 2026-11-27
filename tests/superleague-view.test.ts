import { describe, expect, it } from "vitest";
import {
  getSuperLeagueDetailState,
  selectSuperLeagueWeek,
} from "@/lib/domain/superLeagueView";

describe("SuperLeague details presentation", () => {
  it("shows a preparation state, not a network error, at the new weekly rollover", () => {
    const overview = {
      currentWeek: "2026-11-27",
      availableWeeks: ["2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27"],
      league: null,
    };
    const selection = selectSuperLeagueWeek(overview.availableWeeks, overview.currentWeek);
    expect(selection.selected).toBe("2026-11-27");
    expect(getSuperLeagueDetailState({
      loading: false, failed: false, league: overview.league,
      selectedWeek: selection.selected, currentWeek: overview.currentWeek,
    })).toBe("preparing");
  });

  it("shows a single retry state only after an actual request failure", () => {
    expect(getSuperLeagueDetailState({
      loading: false, failed: true, league: null,
      selectedWeek: "2026-11-27", currentWeek: "2026-11-27",
    })).toBe("unavailable");
  });

  it("preserves valid details while a silent refresh is in progress", () => {
    expect(getSuperLeagueDetailState({
      loading: true, failed: true, league: { slates: [] },
      selectedWeek: "2026-11-27", currentWeek: "2026-11-27",
    })).toBe("ready");
  });

  it("does not mistake an unpopulated historical week for a network failure", () => {
    expect(getSuperLeagueDetailState({
      loading: false, failed: false, league: null,
      selectedWeek: "2026-11-06", currentWeek: "2026-11-27",
    })).toBe("no-group");
  });

  it("retains a manually selected earlier week on refresh, but defaults to current week", () => {
    const available = ["2026-11-20", "2026-11-13"];
    expect(selectSuperLeagueWeek(available, "2026-11-27").selected).toBe("2026-11-27");
    expect(selectSuperLeagueWeek(available, "2026-11-27", "2026-11-13").selected).toBe("2026-11-13");
  });
});
