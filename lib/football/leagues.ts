export const LEAGUES = [
  { code: "GB1", apiLeagueId: 39, slug: "premier-league", logo: "/leagues/premier-league.png", faName: "\u0644\u06cc\u06af \u0628\u0631\u062a\u0631 \u0627\u0646\u06af\u0644\u06cc\u0633", enName: "Premier League", short: "\u067e\u0631\u06cc\u0645\u06cc\u0631\u0644\u06cc\u06af" },
  { code: "ES1", apiLeagueId: 140, slug: "laliga", logo: "/leagues/la-liga.png", faName: "\u0644\u0627\u0644\u06cc\u06af\u0627", enName: "La Liga", short: "\u0644\u0627\u0644\u06cc\u06af\u0627" },
  { code: "L1", apiLeagueId: 78, slug: "bundesliga", logo: "/leagues/bundesliga.png", faName: "\u0628\u0648\u0646\u062f\u0633\u0644\u06cc\u06af\u0627", enName: "Bundesliga", short: "\u0628\u0648\u0646\u062f\u0633\u0644\u06cc\u06af\u0627" },
  { code: "IT1", apiLeagueId: 135, slug: "serie-a", logo: "/leagues/serie-a.png", faName: "\u0633\u0631\u06cc \u0622", enName: "Serie A", short: "\u0633\u0631\u06cc \u0622" },
  { code: "FR1", apiLeagueId: 61, slug: "ligue-1", logo: "/leagues/ligue-1.png", faName: "\u0644\u06cc\u06af \u06cc\u06a9 \u0641\u0631\u0627\u0646\u0633\u0647", enName: "Ligue 1", short: "\u0644\u06cc\u06af \u06cc\u06a9" },
] as const;
export type LeagueCode = typeof LEAGUES[number]["code"];
export function getLeague(code: string) { return LEAGUES.find((league) => league.code === code); }
