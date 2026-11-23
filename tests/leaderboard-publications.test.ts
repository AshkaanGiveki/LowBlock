import { describe, expect, it } from "vitest";
import {
  leaderboardPublicationKey,
  clubPublicationPolicy,
  MAX_PUBLISHED_ROWS,
} from "@/lib/domain/leaderboardPublications";

describe("published leaderboard scopes", () => {
  const monday = new Date("2026-11-23T12:00:00.000Z");

  it("separates this week and last week and preserves lifetime totals", () => {
    expect(leaderboardPublicationKey({ weekly: true }, monday))
      .toBe("GLOBAL:WEEK:2026-11-20T00:00:00.000Z");
    expect(leaderboardPublicationKey({ weekly: true, weeklyOffset: 1 }, monday))
      .toBe("GLOBAL:WEEK:2026-11-13T00:00:00.000Z");
    expect(leaderboardPublicationKey({}, monday)).toBe("GLOBAL:HISTORY");
    expect(leaderboardPublicationKey({ seasonStartYear: 2026 }, monday))
      .toBe("GLOBAL:SEASON:2026");
  });

  it("keeps club and tournament rankings in their own scopes", () => {
    expect(leaderboardPublicationKey({ clubId: "abc", weekly: true }, monday))
      .toBe("CLUB:abc:WEEK:2026-11-20T00:00:00.000Z");
    expect(leaderboardPublicationKey({ clubId: "abc" }, monday))
      .toBe("CLUB:abc:HISTORY");
    expect(leaderboardPublicationKey({ leagueCode: "GB_FA", seasonStartYear: 2026 }, monday))
      .toBe("TOURNAMENT:GB_FA:2026");
    expect(leaderboardPublicationKey({ leagueCode: "GB_FA", weekly: true }, monday))
      .toBeNull();
    expect(leaderboardPublicationKey({ clubId: "abc", leagueCode: "GB_FA" }, monday))
      .toBeNull();
    expect(leaderboardPublicationKey({ leagueCode: "GB_FA", matchday: 1 }, monday))
      .toBeNull();
  });

  it("recognizes club rules independent of tournament order", () => {
    expect(clubPublicationPolicy(["GB1", "UCL", "GB1"]))
      .toBe(clubPublicationPolicy(["UCL", "GB1"]));
    expect(clubPublicationPolicy(["GB1"]))
      .not.toBe(clubPublicationPolicy(["GB1", "GB_FA"]));
    expect(MAX_PUBLISHED_ROWS).toBe(100);
  });
});
