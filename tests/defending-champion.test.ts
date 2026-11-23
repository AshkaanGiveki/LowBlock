import { describe, expect, it } from "vitest";
import { getDefendingChampionUserId } from "@/lib/awards/defendingChampion";

describe("defending champion", () => {
  it("reads the published previous-week winner without touching prediction scores", async () => {
    let scoreQueries = 0;
    const db = {
      collection(name: string) {
        if (name === "leaderboardPublications") return {
          async findOne() { return { rows: [{ userId: "winner" }] }; },
        };
        if (name === "predictionScores") {
          scoreQueries++;
          throw new Error("Expensive score query should be skipped");
        }
        throw new Error("Unexpected collection: " + name);
      },
    };
    expect(await getDefendingChampionUserId(db as any)).toBe("winner");
    expect(scoreQueries).toBe(0);
  });

  it("uses an indexed kickoff-time query rather than a history-wide join before first publication", async () => {
    let pipeline: any[] | null = null;
    const db = {
      collection(name: string) {
        if (name === "leaderboardPublications") return { async findOne() { return null; } };
        if (name === "predictionScores") return {
          aggregate(steps: any[]) {
            pipeline = steps;
            return { async toArray() { return [{ _id: "first-week-winner" }]; } };
          },
        };
        throw new Error("Unexpected collection: " + name);
      },
    };
    expect(await getDefendingChampionUserId(db as any)).toBe("first-week-winner");
    expect(pipeline?.[0]).toMatchObject({ $match: { globalEligible: true } });
    expect(pipeline?.some((step: any) => step.$lookup)).toBe(false);
  });

  it("allows a week with no previous winner", async () => {
    const db = {
      collection(name: string) {
        if (name === "leaderboardPublications") return { async findOne() { return { rows: [] }; } };
        throw new Error("No other database work expected: " + name);
      },
    };
    expect(await getDefendingChampionUserId(db as any)).toBeNull();
  });
});
