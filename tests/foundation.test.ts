import { describe, expect, it } from "vitest";
import { compareRank, rankRows } from "@/lib/domain/ranking";
import { isPredictionLocked } from "@/lib/domain/predictionLock";

describe("foundation invariants", () => {
  it("locks predictions at the server deadline", () => {
    const kickoff = new Date("2026-08-22T12:00:00Z");
    expect(isPredictionLocked({ kickoffAt: kickoff }, new Date("2026-08-22T11:59:59Z"))).toBe(false);
    expect(isPredictionLocked({ kickoffAt: kickoff }, new Date("2026-08-22T12:00:00Z"))).toBe(true);
  });
  it("uses one shared ranking policy", () => {
    const rows = [{ userId: "b", points: 10, exact: 1, predictions: 4 }, { userId: "a", points: 10, exact: 1, predictions: 4 }];
    expect(compareRank(rows[1], rows[0])).toBeLessThan(0);
    expect(rankRows(rows).map(row => row.userId)).toEqual(["a", "b"]);
  });
});
