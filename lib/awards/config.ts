export const ROUND_WINNER_TYPE = "ROUND_WINNER" as const;
export const CLUB_ROUND_WINNER_TYPE = "CLUB_ROUND_WINNER" as const;
export const WEEKLY_WINNER_TYPE = "WEEKLY_WINNER" as const;
export const CLUB_WEEKLY_WINNER_TYPE = "CLUB_WEEKLY_WINNER" as const;
export const LEAGUE_WINNER_TYPE = "LEAGUE_WINNER" as const;
export const TOURNAMENT_WINNER_TYPE = "TOURNAMENT_WINNER" as const;
export const GLOBAL_WINNER_TYPE = "GLOBAL_WINNER" as const;
export const CLUB_LEAGUE_WINNER_TYPE = "CLUB_LEAGUE_WINNER" as const;
export const MONTHLY_EXACT_WINNER_TYPE = "MONTHLY_EXACT_WINNER" as const;
export const CLUB_MONTHLY_EXACT_WINNER_TYPE = "CLUB_MONTHLY_EXACT_WINNER" as const;
export const LOWBLOCK_SCOPE = "LOWBLOCK" as const;

export type AssetEntry = { leagueCode?: string; leagueName?: string; seasonStartYear?: number; roundNumber?: number; trophy: string; shareCard: string };
const join = (...parts: string[]) => parts.filter(Boolean).join("/");
// These are server-only assets. They are streamed through authorized API
// routes and are deliberately not placed under `public`.
const root = typeof window === "undefined" ? join(process.cwd(), "lib", "server-assets", "awards") : "";
const pair = (folder: string): AssetEntry => ({ trophy: join(folder, "Trophy.png"), shareCard: join(folder, "Card.png") });
const league = (leagueCode: string, leagueName: string): AssetEntry => ({ ...pair(join(root, "round", "global", leagueCode)), leagueCode, leagueName });
const clubLeague = (leagueCode: string, leagueName: string): AssetEntry => ({ ...pair(join(root, "round", "club", leagueCode)), leagueCode, leagueName });

// Canonical design per league/scope. The period is dynamic data, not an asset variant.
export const ROUND_WINNER_ASSETS: Record<string, AssetEntry> = {
  GB1: league("GB1", "Premier League"),
  ES1: { ...league("ES1", "LaLiga"), trophy: join(root, "round", "global", "ES1", "Trophy.webp"), shareCard: join(root, "round", "global", "ES1", "Card.webp") },
  L1: league("L1", "Bundesliga"),
  IT1: league("IT1", "Serie A"),
  FR1: league("FR1", "Ligue 1"),
};
export function getRoundWinnerAsset(leagueCode: string, seasonStartYear: number, _roundNumber: number) { return ROUND_WINNER_ASSETS[leagueCode] && Number.isFinite(seasonStartYear) ? ROUND_WINNER_ASSETS[leagueCode] : null; }

export const CLUB_ROUND_ASSETS: Record<string, AssetEntry> = {
  GB1: clubLeague("GB1", "Premier League"),
  ES1: clubLeague("ES1", "LaLiga"),
  L1: clubLeague("L1", "Bundesliga"),
  IT1: clubLeague("IT1", "Serie A"),
  FR1: clubLeague("FR1", "Ligue 1"),
};
export function getClubRoundAsset(leagueCode: string, seasonStartYear: number, _roundNumber: number) { return CLUB_ROUND_ASSETS[leagueCode] && Number.isFinite(seasonStartYear) ? CLUB_ROUND_ASSETS[leagueCode] : null; }

export const WEEKLY_LOWBLOCK_ASSET = pair(join(root, "weekly", "global"));
export function getWeeklyLowBlockAsset() { return WEEKLY_LOWBLOCK_ASSET; }
export const CLUB_WEEKLY_ASSET = pair(join(root, "weekly", "club"));
export function getClubWeeklyAsset() { return CLUB_WEEKLY_ASSET; }
export const GLOBAL_EXACT_PICKER_ASSET = pair(join(root, "monthly-exact", "global"));
export const CLUB_EXACT_PICKER_ASSET = pair(join(root, "monthly-exact", "club"));
export const GLOBAL_LEAGUE_WINNER_ASSET = pair(join(root, "league", "global"));
export const CLUB_LEAGUE_WINNER_ASSET = pair(join(root, "league", "club"));

export function getAwardAssetContentType(filePath: string) { return filePath.toLowerCase().endsWith(".webp") ? "image/webp" : "image/png"; }
export function getAwardAsset(award: { type?: string; competitionId?: string; seasonStartYear?: number; roundNumber?: number }) {
  switch (award.type) {
    case WEEKLY_WINNER_TYPE: return getWeeklyLowBlockAsset();
    case CLUB_WEEKLY_WINNER_TYPE: return getClubWeeklyAsset();
    case MONTHLY_EXACT_WINNER_TYPE: return GLOBAL_EXACT_PICKER_ASSET;
    case CLUB_MONTHLY_EXACT_WINNER_TYPE: return CLUB_EXACT_PICKER_ASSET;
    case GLOBAL_WINNER_TYPE:
    case LEAGUE_WINNER_TYPE:
    case TOURNAMENT_WINNER_TYPE: return GLOBAL_LEAGUE_WINNER_ASSET;
    case CLUB_LEAGUE_WINNER_TYPE: return CLUB_LEAGUE_WINNER_ASSET;
    case CLUB_ROUND_WINNER_TYPE: return award.competitionId && award.seasonStartYear ? getClubRoundAsset(award.competitionId, award.seasonStartYear, award.roundNumber ?? 1) : null;
    case ROUND_WINNER_TYPE: return award.competitionId && award.seasonStartYear ? getRoundWinnerAsset(award.competitionId, award.seasonStartYear, award.roundNumber ?? 1) : null;
    default: return null;
  }
}
