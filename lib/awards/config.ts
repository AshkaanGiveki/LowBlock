import path from "node:path";

export const ROUND_WINNER_TYPE = "ROUND_WINNER" as const;
export const CLUB_ROUND_WINNER_TYPE = "CLUB_ROUND_WINNER" as const;
export const WEEKLY_WINNER_TYPE = "WEEKLY_WINNER" as const;
export const CLUB_WEEKLY_WINNER_TYPE = "CLUB_WEEKLY_WINNER" as const;
export const LEAGUE_WINNER_TYPE = "LEAGUE_WINNER" as const;
export const GLOBAL_WINNER_TYPE = "GLOBAL_WINNER" as const;
export const MONTHLY_EXACT_WINNER_TYPE = "MONTHLY_EXACT_WINNER" as const;
export const LOWBLOCK_SCOPE = "LOWBLOCK" as const;
type AssetEntry = { leagueCode: string; leagueName: string; seasonStartYear: number; roundNumber: number; trophy: string; shareCard: string };
const privateRoot = path.join(process.cwd(), "lib", "server-assets", "awards");
const clubRoot = path.join(privateRoot, "Club");
const asset = (leagueCode: string, leagueName: string, folder: string, roundNumber: number, lowBlockFolder = true): AssetEntry => ({ leagueCode, leagueName, seasonStartYear: 2026, roundNumber, trophy: path.join(privateRoot, folder, ...(lowBlockFolder ? ["LowBlock"] : []), `MD${String(roundNumber).padStart(2, "0")}`, "Trophy.png"), shareCard: path.join(privateRoot, folder, ...(lowBlockFolder ? ["LowBlock"] : []), `MD${String(roundNumber).padStart(2, "0")}`, "Card.png") });
const clubAsset = (leagueCode: string, leagueName: string, folder: string, roundNumber: number): AssetEntry => ({ leagueCode, leagueName, seasonStartYear: 2026, roundNumber, trophy: path.join(clubRoot, folder, `MD${String(roundNumber).padStart(2, "0")}`, "Trophy.png"), shareCard: path.join(clubRoot, folder, `MD${String(roundNumber).padStart(2, "0")}`, "Card.png") });
export const ROUND_WINNER_ASSETS: Record<string, AssetEntry> = {
  "GB1:2026:1": asset("GB1", "Premier League", "PremierLeague", 1),
  "ES1:2026:2": asset("ES1", "LaLiga", "LaLiga", 2),
  "L1:2026:1": asset("L1", "Bundesliga", "BundesLiga", 1, false),
  "IT1:2026:1": asset("IT1", "Serie A", "SerieA", 1),
  "FR1:2026:1": asset("FR1", "Ligue 1", "Ligue1", 1),
};
export function getRoundWinnerAsset(leagueCode: string, seasonStartYear: number, roundNumber: number) { return ROUND_WINNER_ASSETS[`${leagueCode}:${seasonStartYear}:${roundNumber}`] ?? null; }

export const CLUB_ROUND_ASSETS: Record<string, AssetEntry> = {
  "GB1:2026:1": clubAsset("GB1", "Premier League", "Premier League", 1),
  "ES1:2026:1": clubAsset("ES1", "LaLiga", "LaLiga", 1),
  "ES1:2026:2": clubAsset("ES1", "LaLiga", "LaLiga", 2),
  "L1:2026:1": clubAsset("L1", "Bundesliga", "BundesLiga", 1),
  "IT1:2026:1": clubAsset("IT1", "Serie A", "SerieA", 1),
  "FR1:2026:1": clubAsset("FR1", "Ligue 1", "Ligue1", 1),
};
export function getClubRoundAsset(leagueCode: string, seasonStartYear: number, roundNumber: number) { return CLUB_ROUND_ASSETS[`${leagueCode}:${seasonStartYear}:${roundNumber}`] ?? null; }

export const WEEKLY_LOWBLOCK_ASSET = { trophy: path.join(privateRoot, "Weekly", "Trophy.png"), shareCard: path.join(privateRoot, "Weekly", "Card.png") };
export function getWeeklyLowBlockAsset() { return WEEKLY_LOWBLOCK_ASSET; }
export const CLUB_WEEKLY_ASSET = { trophy: path.join(clubRoot, "Weekly", "21-27Aug", "Trophy.png"), shareCard: path.join(clubRoot, "Weekly", "21-27Aug", "Card.png") };
export function getClubWeeklyAsset() { return CLUB_WEEKLY_ASSET; }

export function getAwardAsset(award: { type?: string; scope?: string; competitionId?: string; seasonStartYear?: number; roundNumber?: number }) {
  if (award.type === WEEKLY_WINNER_TYPE) return getWeeklyLowBlockAsset();
  if (award.type === CLUB_WEEKLY_WINNER_TYPE) return getClubWeeklyAsset();
  if (award.type === CLUB_ROUND_WINNER_TYPE && award.competitionId && award.seasonStartYear && award.roundNumber) return getClubRoundAsset(award.competitionId, award.seasonStartYear, award.roundNumber);
  if (award.competitionId && award.seasonStartYear && award.roundNumber) return getRoundWinnerAsset(award.competitionId, award.seasonStartYear, award.roundNumber);
  return null;
}
