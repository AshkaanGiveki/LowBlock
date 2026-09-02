export type CompetitionConfig = {
  code: string;
  apiLeagueId: number;
  slug: string;
  logo: string;
  faName: string;
  enName: string;
  short: string;
  globalLeaderboard: boolean;
  h2h: boolean;
  defaultClubLeaderboard: boolean;
  kind: "LEAGUE" | "TOURNAMENT" | "INTERNATIONAL";
};

export const LEAGUES = [
  { code: "GB1", apiLeagueId: 39, slug: "premier-league", logo: "/leagues/premier-league.png", faName: "لیگ برتر انگلیس", enName: "Premier League", short: "پریمیرلیگ", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "LEAGUE" },
  { code: "ES1", apiLeagueId: 140, slug: "laliga", logo: "/leagues/la-liga.png", faName: "لالیگا", enName: "La Liga", short: "لالیگا", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "LEAGUE" },
  { code: "L1", apiLeagueId: 78, slug: "bundesliga", logo: "/leagues/bundesliga.png", faName: "بوندسلیگا", enName: "Bundesliga", short: "بوندسلیگا", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "LEAGUE" },
  { code: "IT1", apiLeagueId: 135, slug: "serie-a", logo: "/leagues/serie-a.png", faName: "سری آ", enName: "Serie A", short: "سری آ", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "LEAGUE" },
  { code: "FR1", apiLeagueId: 61, slug: "ligue-1", logo: "/leagues/ligue-1.png", faName: "لیگ یک فرانسه", enName: "Ligue 1", short: "لیگ یک", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "LEAGUE" },
  { code: "UCL", apiLeagueId: 2, slug: "uefa-champions-league", logo: "/leagues/champions-league.png", faName: "لیگ قهرمانان اروپا", enName: "UEFA Champions League", short: "UCL", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "TOURNAMENT" },
  { code: "WC", apiLeagueId: 1, slug: "fifa-world-cup", logo: "/leagues/world-cup.png", faName: "جام جهانی", enName: "FIFA World Cup", short: "World Cup", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "TOURNAMENT" },
  { code: "EURO", apiLeagueId: 4, slug: "uefa-euro", logo: "/leagues/euro.png", faName: "یورو", enName: "UEFA Euro", short: "Euro", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "TOURNAMENT" },
  { code: "COPA", apiLeagueId: 9, slug: "copa-america", logo: "/leagues/copa-america.png", faName: "کوپا آمریکا", enName: "Copa América", short: "Copa América", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "TOURNAMENT" },
  { code: "WCQ_EU", apiLeagueId: 32, slug: "world-cup-qualification-europe", logo: "/leagues/world-cup.png", faName: "انتخابی جام جهانی اروپا", enName: "World Cup Qualifiers Europe", short: "WCQ Europe", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "INTERNATIONAL" },
  { code: "WCQ_ASIA", apiLeagueId: 30, slug: "world-cup-qualification-asia", logo: "/leagues/world-cup.png", faName: "انتخابی جام جهانی آسیا", enName: "World Cup Qualifiers Asia", short: "WCQ Asia", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "INTERNATIONAL" },
  { code: "WCQ_AFRICA", apiLeagueId: 29, slug: "world-cup-qualification-africa", logo: "/leagues/world-cup.png", faName: "انتخابی جام جهانی آفریقا", enName: "World Cup Qualifiers Africa", short: "WCQ Africa", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "INTERNATIONAL" },
  { code: "WCQ_SAM", apiLeagueId: 34, slug: "world-cup-qualification-south-america", logo: "/leagues/world-cup.png", faName: "انتخابی جام جهانی آمریکای جنوبی", enName: "World Cup Qualifiers South America", short: "WCQ South America", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "INTERNATIONAL" },
  { code: "WCQ_CONCACAF", apiLeagueId: 31, slug: "world-cup-qualification-concacaf", logo: "/leagues/world-cup.png", faName: "انتخابی جام جهانی کونکاکاف", enName: "World Cup Qualifiers CONCACAF", short: "WCQ CONCACAF", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "INTERNATIONAL" },
  { code: "WCQ_OCEANIA", apiLeagueId: 33, slug: "world-cup-qualification-oceania", logo: "/leagues/world-cup.png", faName: "انتخابی جام جهانی اقیانوسیه", enName: "World Cup Qualifiers Oceania", short: "WCQ Oceania", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "INTERNATIONAL" },
  { code: "EUROQ", apiLeagueId: 960, slug: "uefa-euro-qualification", logo: "/leagues/euro.png", faName: "انتخابی یورو", enName: "UEFA Euro Qualifiers", short: "Euro Qualifiers", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "INTERNATIONAL" },
  { code: "NATIONS", apiLeagueId: 5, slug: "uefa-nations-league", logo: "/leagues/euro.png", faName: "لیگ ملت‌های اروپا", enName: "UEFA Nations League", short: "Nations League", globalLeaderboard: true, h2h: true, defaultClubLeaderboard: true, kind: "INTERNATIONAL" },
  { code: "UEL", apiLeagueId: 3, slug: "uefa-europa-league", logo: "/leagues/europa-league.png", faName: "لیگ اروپا", enName: "UEFA Europa League", short: "UEL", globalLeaderboard: false, h2h: false, defaultClubLeaderboard: false, kind: "TOURNAMENT" },
  { code: "ACLE", apiLeagueId: 17, slug: "afc-champions-league-elite", logo: "/leagues/afc.png", faName: "لیگ قهرمانان الیت آسیا", enName: "AFC Champions League Elite", short: "ACLE", globalLeaderboard: false, h2h: false, defaultClubLeaderboard: false, kind: "TOURNAMENT" },
  { code: "IR1", apiLeagueId: 290, slug: "persian-gulf-pro-league", logo: "/leagues/iran.png", faName: "لیگ برتر خلیج فارس", enName: "Persian Gulf Pro League", short: "Iran", globalLeaderboard: false, h2h: false, defaultClubLeaderboard: false, kind: "LEAGUE" },
  { code: "SA1", apiLeagueId: 307, slug: "saudi-pro-league", logo: "/leagues/saudi-pro-league.png", faName: "لیگ حرفه‌ای عربستان", enName: "Saudi Pro League", short: "Saudi Pro", globalLeaderboard: false, h2h: false, defaultClubLeaderboard: false, kind: "LEAGUE" },
  { code: "FRIENDLY", apiLeagueId: 10, slug: "international-friendlies", logo: "/leagues/international.png", faName: "دوستانه ملی", enName: "International Friendlies", short: "Friendlies", globalLeaderboard: false, h2h: false, defaultClubLeaderboard: false, kind: "INTERNATIONAL" },
] as const satisfies readonly CompetitionConfig[];

export type LeagueCode = typeof LEAGUES[number]["code"];
export function getLeague(code: string) { return LEAGUES.find((league) => league.code === code); }
export const GLOBAL_LEAGUE_CODES = LEAGUES.filter((league) => league.globalLeaderboard).map((league) => league.code);
export const DEFAULT_CLUB_LEAGUE_CODES = LEAGUES.filter((league) => league.defaultClubLeaderboard).map((league) => league.code);
export function isGlobalCompetition(code: string) { return Boolean(LEAGUES.find((league) => league.code === code)?.globalLeaderboard); }
export function isH2HCompetition(code: string) { return Boolean(LEAGUES.find((league) => league.code === code)?.h2h); }

const IMPORTANT_NATIONAL_TEAMS = new Set([
  "Argentina", "Australia", "Belgium", "Brazil", "Cameroon", "Canada", "Chile", "Colombia", "Croatia", "Denmark", "Ecuador", "Egypt", "England", "France", "Germany", "Ghana", "Iran", "Italy", "Japan", "Mexico", "Morocco", "Netherlands", "Nigeria", "Norway", "Peru", "Poland", "Portugal", "Senegal", "Serbia", "South Korea", "Spain", "Switzerland", "Turkey", "Uruguay", "USA",
]);
export function isQualityInternationalFriendly(home: string, away: string) {
  return IMPORTANT_NATIONAL_TEAMS.has(home) && IMPORTANT_NATIONAL_TEAMS.has(away);
}
