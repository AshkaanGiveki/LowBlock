import { describe, expect, it } from "vitest";
import { compareRank, rankRows } from "@/lib/domain/ranking";

describe("canonical ranking tie-breaks", () => {
  it("orders points, exact scores, outcomes, prediction time, picks, then user id", () => {
    const rows = [
      { userId: "b", username: "B", points: 10, exact: 1, correctOutcome: 2, globalPoints: 2, earliestPredictionAt: 200, predictions: 4 },
      { userId: "a", username: "A", points: 10, exact: 1, correctOutcome: 2, globalPoints: 2, earliestPredictionAt: 100, predictions: 4 },
      { userId: "c", username: "C", points: 10, exact: 0, correctOutcome: 4, globalPoints: 2, earliestPredictionAt: 50, predictions: 3 },
    ];
    expect(rankRows(rows).map(row => row.userId)).toEqual(["a", "b", "c"]);
    expect(compareRank(rows[0], rows[1])).toBeGreaterThan(0);
  });
});
