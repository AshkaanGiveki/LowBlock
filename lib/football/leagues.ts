export const LEAGUES = [
 { code:"GB1", slug:"premier-league", faName:"لیگ برتر انگلیس", short:"پریمیرلیگ" },
 { code:"ES1", slug:"laliga", faName:"لالیگا", short:"لالیگا" },
 { code:"L1", slug:"bundesliga", faName:"بوندس‌لیگا", short:"بوندس‌لیگا" },
 { code:"IT1", slug:"serie-a", faName:"سری آ", short:"سری آ" },
 { code:"FR1", slug:"ligue-1", faName:"لیگ یک فرانسه", short:"لیگ یک" },
] as const;
export type LeagueCode = typeof LEAGUES[number]["code"];
export function getLeague(code:string){ return LEAGUES.find(l=>l.code===code); }
