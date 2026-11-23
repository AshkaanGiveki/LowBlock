import { describe, expect, it } from "vitest";
import {
  leaderboardPublicationKey,
  clubPublicationPolicy,
  MAX_PUBLISHED_ROWS,
  readPublishedLeaderboard,
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

describe("reading published standings", () => {
  function fakeDb(rows: any[] | null, clubCodes = ["GB1", "UCL"]) {
    const db = {
      collection(name: string) {
        return {
          async findOne() {
            if (name === "leaderboardPublications") {
              return rows === null ? null : {
                rows,
                policyKey: clubPublicationPolicy(clubCodes),
              };
            }
            if (name === "clubs") return { leaderboardCompetitionCodes: clubCodes };
            throw new Error(`Unexpected collection ${name}`);
          },
        };
      },
    };
    return db as any;
  }

  it("returns an intentionally empty published ranking without recalculating", async () => {
    expect(await readPublishedLeaderboard(fakeDb([]), {}, 20)).toEqual([]);
    expect(await readPublishedLeaderboard(fakeDb(null), {}, 20)).toBeNull();
  });

  it("supports a cursor inside the published top rows and falls back for unknown cursors", async () => {
    const rows = [
      { userId: "alpha", points: 10 },
      { userId: "beta", points: 7 },
      { userId: "gamma", points: 5 },
    ];
    expect(await readPublishedLeaderboard(fakeDb(rows), {}, 1, { userId: "alpha", points: 10 }))
      .toEqual([rows[1]]);
    expect(await readPublishedLeaderboard(fakeDb(rows), {}, 1, { userId: "missing", points: 12 }))
      .toBeNull();
  });

  it("avoids serving outdated club rules", async () => {
    const id = "507f1f77bcf86cd799439011";
    const db = fakeDb([{ userId: "alpha", points: 10 }], ["GB1"]);
    // Policy signatures do not match, so the fallback must recompute.
    const original = db.collection.bind(db);
    db.collection = (name: string) => {
      const collection = original(name);
      if (name === "leaderboardPublications") return {
        ...collection,
        findOne: async () => ({ rows: [{ userId: "alpha", points: 10 }], policyKey: clubPublicationPolicy(["GB1", "UCL"]) }),
      };
      return collection;
    };
    expect(await readPublishedLeaderboard(db, { clubId: id }, 20)).toBeNull();
  });
});
