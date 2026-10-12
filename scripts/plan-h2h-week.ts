import { closeMongo, getDb } from "../lib/db/mongo";
import { getH2HWeek, buildH2HSlates } from "../lib/domain/h2h";
import { providerWeekDateKeys } from "../lib/football/scheduleWindow";
import { SportsApiFootballProvider } from "../lib/football/sportsapi/provider";

async function main() {
  const db = await getDb();
  const week = getH2HWeek(new Date(), 1);
  const dates = providerWeekDateKeys(week.start);
  const provider = new SportsApiFootballProvider();
  const { discovery } = await provider.syncWeekDates(dates);
  const matches = await db.collection<any>("matches").find({ kickoffAt: { $gte: week.start, $lt: week.end }, provider: "sportsapi" }).toArray();
  const ratingRows = await db.collection<any>("centralTeams").find({ h2hRating: { $gte: 1, $lte: 100 } }, { projection: { centralTeamId: 1, h2hRating: 1 } }).toArray();
  const ratings = new Map(ratingRows.map((row) => [String(row.centralTeamId), Number(row.h2hRating)]));
  const slates = buildH2HSlates(matches, week, ratings);
  const byDate = new Map<string, any[]>();
  for (const match of matches) {
    const date = new Date(match.kickoffAt).toISOString().slice(0, 10);
    const score = (() => {
      const home = ratings.get(String(match.homeTeam?.centralTeamId)) ?? 0;
      const away = ratings.get(String(match.awayTeam?.centralTeamId)) ?? 0;
      const weight = ({ UCL: 1.2, GB1: 1.18, ES1: 1.16, IT1: 1.14, L1: 1.12, UEL: 1.12, FR1: 1.1, SA1: 1.08, ACLE: 1.08, TR1: 1.07, NATIONS: 1.07, GB2: 1.05, IR1: 1.04, FRIENDLY: 1 } as Record<string, number>)[String(match.leagueCode)] ?? 1;
      return (home + away) * weight;
    })();
    if (score <= 0 || ["FINISHED", "CANCELLED", "POSTPONED", "ABANDONED"].includes(String(match.status).toUpperCase())) continue;
    const rows = byDate.get(date) ?? [];
    rows.push({ id: String(match.providerMatchId), home: match.homeTeam?.name, away: match.awayTeam?.name, leagueCode: match.leagueCode, kickoffAt: match.kickoffAt, homeRating: ratings.get(String(match.homeTeam?.centralTeamId)) ?? 0, awayRating: ratings.get(String(match.awayTeam?.centralTeamId)) ?? 0, score });
    byDate.set(date, rows);
  }
  for (const rows of byDate.values()) rows.sort((a, b) => b.score - a.score || new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  console.log(JSON.stringify({ week: { key: week.key, dates }, discovery: { complete: discovery.complete, manifests: discovery.manifests }, selectedSlates: slates.map((slate) => ({ matchday: slate.matchday, sourceDate: slate.sourceDate, fixtures: slate.fixtures.map((fixture) => ({ id: fixture.matchId, home: fixture.homeTeam?.name, away: fixture.awayTeam?.name, leagueCode: fixture.leagueCode, kickoffAt: fixture.kickoffAt, score: fixture.score })) })), positiveByDate: Object.fromEntries(dates.map((date) => [date, (byDate.get(date) ?? []).slice(0, 5)])) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeMongo().catch(() => undefined));
