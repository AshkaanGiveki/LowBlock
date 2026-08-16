export const LEAGUES = [
 { code:"GB1", apiLeagueId:39, slug:"premier-league", faName:"Ù„ÛŒÚ¯ Ø¨Ø±ØªØ± Ø§Ù†Ú¯Ù„ÛŒØ³", short:"Ù¾Ø±ÛŒÙ…ÛŒØ±Ù„ÛŒÚ¯" },
 { code:"ES1", apiLeagueId:140, slug:"laliga", faName:"Ù„Ø§Ù„ÛŒÚ¯Ø§", short:"Ù„Ø§Ù„ÛŒÚ¯Ø§" },
 { code:"L1", apiLeagueId:78, slug:"bundesliga", faName:"Ø¨ÙˆÙ†Ø¯Ø³â€ŒÙ„ÛŒÚ¯Ø§", short:"Ø¨ÙˆÙ†Ø¯Ø³â€ŒÙ„ÛŒÚ¯Ø§" },
 { code:"IT1", apiLeagueId:135, slug:"serie-a", faName:"Ø³Ø±ÛŒ Ø¢", short:"Ø³Ø±ÛŒ Ø¢" },
 { code:"FR1", apiLeagueId:61, slug:"ligue-1", faName:"Ù„ÛŒÚ¯ ÛŒÚ© ÙØ±Ø§Ù†Ø³Ù‡", short:"Ù„ÛŒÚ¯ ÛŒÚ©" },
] as const;
export type LeagueCode = typeof LEAGUES[number]["code"];
export function getLeague(code:string){ return LEAGUES.find(l=>l.code===code); }
