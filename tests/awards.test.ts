import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { CLUB_LEAGUE_WINNER_ASSET, CLUB_EXACT_PICKER_ASSET, CLUB_ROUND_ASSETS, CLUB_WEEKLY_ASSET, CLUB_MONTHLY_EXACT_WINNER_TYPE, GLOBAL_LEAGUE_WINNER_ASSET, GLOBAL_EXACT_PICKER_ASSET, getAwardAsset, getAwardAssetContentType, getRoundWinnerAsset, MONTHLY_EXACT_WINNER_TYPE, GLOBAL_WINNER_TYPE } from "@/lib/awards/config";
import { rankRows } from "@/lib/domain/ranking";
describe("round winner awards", () => {
  it("maps each supplied first-release asset to the intended competition and round", () => {
    expect(getRoundWinnerAsset("GB1", 2026, 1)?.leagueName).toBe("Premier League");
    expect(getRoundWinnerAsset("ES1", 2026, 2)?.leagueName).toBe("LaLiga");
    expect(getRoundWinnerAsset("L1", 2026, 1)?.trophy.replaceAll("\\", "/").endsWith("round/global/L1/Trophy.png")).toBe(true);
    expect(getRoundWinnerAsset("IT1", 2026, 1)?.leagueName).toBe("Serie A");
    expect(getRoundWinnerAsset("FR1", 2026, 1)?.leagueName).toBe("Ligue 1");
    expect(getRoundWinnerAsset("GB1", 2026, 2)?.trophy).toBe(getRoundWinnerAsset("GB1", 2026, 1)?.trophy);
    expect(getRoundWinnerAsset("ES1", 2026, 1)?.trophy.replaceAll("\\", "/").endsWith("round/global/ES1/Trophy.webp")).toBe(true);
    expect(getAwardAssetContentType("Trophy.webp")).toBe("image/webp");
  });
  it("maps every award type to one canonical design family", () => {
    expect(getAwardAsset({ type: "WEEKLY_WINNER" })?.trophy).toBeTruthy();
    expect(getAwardAsset({ type: "CLUB_WEEKLY_WINNER" })?.trophy).toBe(CLUB_WEEKLY_ASSET.trophy);
    expect(getAwardAsset({ type: "ROUND_WINNER", competitionId: "ES1", seasonStartYear: 2026, roundNumber: 99 })?.trophy).toBe(getRoundWinnerAsset("ES1", 2026, 1)?.trophy);
    expect(getAwardAsset({ type: "CLUB_ROUND_WINNER", competitionId: "L1", seasonStartYear: 2026, roundNumber: 99 })?.trophy).toBe(CLUB_ROUND_ASSETS.L1.trophy);
    expect(getAwardAsset({ type: MONTHLY_EXACT_WINNER_TYPE })?.trophy).toBe(GLOBAL_EXACT_PICKER_ASSET.trophy);
    expect(getAwardAsset({ type: CLUB_MONTHLY_EXACT_WINNER_TYPE })?.trophy).toBe(CLUB_EXACT_PICKER_ASSET.trophy);
    expect(getAwardAsset({ type: GLOBAL_WINNER_TYPE })?.trophy).toBe(GLOBAL_LEAGUE_WINNER_ASSET.trophy);
    expect(getAwardAsset({ type: "CLUB_LEAGUE_WINNER" })?.trophy).toBe(CLUB_LEAGUE_WINNER_ASSET.trophy);
  });
  it("points every canonical trophy and share card at a shipped file", () => {
    const assets = [
      getAwardAsset({ type: "WEEKLY_WINNER" }),
      getAwardAsset({ type: "CLUB_WEEKLY_WINNER" }),
      getAwardAsset({ type: "ROUND_WINNER", competitionId: "GB1", seasonStartYear: 2026 }),
      getAwardAsset({ type: "CLUB_ROUND_WINNER", competitionId: "ES1", seasonStartYear: 2026 }),
      getAwardAsset({ type: MONTHLY_EXACT_WINNER_TYPE }),
      getAwardAsset({ type: CLUB_MONTHLY_EXACT_WINNER_TYPE }),
      getAwardAsset({ type: GLOBAL_WINNER_TYPE }),
      getAwardAsset({ type: "CLUB_LEAGUE_WINNER" }),
    ];
    for (const asset of assets) {
      expect(asset).not.toBeNull();
      expect(existsSync(asset!.trophy)).toBe(true);
      expect(existsSync(asset!.shareCard)).toBe(true);
    }
  });
  it("uses the application's canonical points/exact/prediction/user-id ordering", () => {
    const [winner] = rankRows([{ userId: "b", points: 10, exact: 1, predictions: 3 }, { userId: "a", points: 10, exact: 1, predictions: 3 }]);
    expect(winner.userId).toBe("a");
    expect(winner.rank).toBe(1);
  });
});
