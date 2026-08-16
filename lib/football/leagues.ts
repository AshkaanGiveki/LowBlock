export const LEAGUES = [
  { code: "GB1", apiLeagueId: 39, slug: "premier-league", faName: "لیگ برتر انگلیس", enName:"Premier League", short: "پریمیرلیگ" },
  { code: "ES1", apiLeagueId: 140, slug: "laliga", faName: "لالیگا", enName:"La Liga", short: "لالیگا" },
  { code: "L1", apiLeagueId: 78, slug: "bundesliga", faName: "بوندس‌لیگا", enName:"Bundesliga", short: "بوندس‌لیگا" },
  { code: "IT1", apiLeagueId: 135, slug: "serie-a", faName: "سری آ", enName:"Serie A", short: "سری آ" },
  { code: "FR1", apiLeagueId: 61, slug: "ligue-1", faName: "لیگ یک فرانسه", enName:"Ligue 1", short: "لیگ یک" },
] as const;

export type LeagueCode = typeof LEAGUES[number]["code"];
export function getLeague(code: string) { return LEAGUES.find((league) => league.code === code); }
