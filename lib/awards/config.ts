import path from "node:path";

export const ROUND_WINNER_TYPE = "ROUND_WINNER" as const;
export const LOWBLOCK_SCOPE = "LOWBLOCK" as const;
type AssetEntry = { leagueCode: string; leagueName: string; seasonStartYear: number; roundNumber: number; trophy: string; shareCard: string };
const privateRoot = path.join(process.cwd(), "lib", "server-assets", "awards");
const asset = (leagueCode: string, leagueName: string, folder: string, roundNumber: number, lowBlockFolder = true): AssetEntry => ({ leagueCode, leagueName, seasonStartYear: 2026, roundNumber, trophy: path.join(privateRoot, folder, ...(lowBlockFolder ? ["LowBlock"] : []), `MD${String(roundNumber).padStart(2, "0")}`, "Trophy.png"), shareCard: path.join(privateRoot, folder, ...(lowBlockFolder ? ["LowBlock"] : []), `MD${String(roundNumber).padStart(2, "0")}`, "Card.png") });
export const ROUND_WINNER_ASSETS: Record<string, AssetEntry> = {
  "GB1:2026:1": asset("GB1", "Premier League", "PremierLeague", 1),
  "ES1:2026:2": asset("ES1", "LaLiga", "LaLiga", 2),
  "L1:2026:1": asset("L1", "Bundesliga", "BundesLiga", 1, false),
  "IT1:2026:1": asset("IT1", "Serie A", "SerieA", 1),
  "FR1:2026:1": asset("FR1", "Ligue 1", "Ligue1", 1),
};
export function getRoundWinnerAsset(leagueCode: string, seasonStartYear: number, roundNumber: number) { return ROUND_WINNER_ASSETS[`${leagueCode}:${seasonStartYear}:${roundNumber}`] ?? null; }
