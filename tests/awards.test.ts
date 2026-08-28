import { describe, expect, it } from "vitest";
import { getRoundWinnerAsset } from "@/lib/awards/config";
import { rankRows } from "@/lib/domain/ranking";
describe("round winner awards", () => {
  it("maps each supplied first-release asset to the intended competition and round", () => {
    expect(getRoundWinnerAsset("GB1", 2026, 1)?.leagueName).toBe("Premier League");
    expect(getRoundWinnerAsset("ES1", 2026, 2)?.leagueName).toBe("LaLiga");
    expect(getRoundWinnerAsset("L1", 2026, 1)?.trophy.endsWith("BundesLiga\\MD01\\Trophy.png")).toBe(true);
    expect(getRoundWinnerAsset("IT1", 2026, 1)?.leagueName).toBe("Serie A");
    expect(getRoundWinnerAsset("FR1", 2026, 1)?.leagueName).toBe("Ligue 1");
    expect(getRoundWinnerAsset("GB1", 2026, 2)).toBeNull();
  });
  it("uses the application's canonical points/exact/prediction/user-id ordering", () => {
    const [winner] = rankRows([{ userId: "b", points: 10, exact: 1, predictions: 3 }, { userId: "a", points: 10, exact: 1, predictions: 3 }]);
    expect(winner.userId).toBe("a");
    expect(winner.rank).toBe(1);
  });
});
