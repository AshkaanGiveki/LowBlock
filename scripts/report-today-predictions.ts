import { getDb, closeMongo } from "../lib/db/mongo";
import { ObjectId } from "mongodb";
import { getLeague, isFeaturedFixture, isGlobalCompetition } from "../lib/football/leagues";

async function main() {
  const db = await getDb();
  const timezone = "Asia/Tehran";
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = new Date(`${dateKey}T00:00:00+03:30`);
  const bounds = { start, end: new Date(start.getTime() + 86_400_000) };
  const matches = await db.collection<any>("matches").find({
    provider: { $in: ["football-api", "sportsapi"] },
    kickoffAt: { $gte: bounds.start, $lt: bounds.end },
    status: { $nin: ["VOID", "CANCELLED"] },
  }).sort({ kickoffAt: 1 }).toArray();

  const eligible = matches.filter((match) =>
    isGlobalCompetition(match.leagueCode) &&
    (getLeague(match.leagueCode)?.kind !== "INTERNATIONAL" || isFeaturedFixture(match.leagueCode, match.homeTeam?.name, match.awayTeam?.name)),
  );
  const ids = eligible.map((match) => String(match.providerMatchId));
  const predictions = ids.length
    ? await db.collection<any>("predictions").find({ matchId: { $in: ids }, userId: { $ne: "guest" } }).sort({ createdAt: 1 }).toArray()
    : [];
  const userIds = [...new Set(predictions.map((row) => String(row.userId)))];
  const users = userIds.length
    ? await db.collection<any>("users").find({ _id: { $in: userIds.map((id) => { try { return new ObjectId(id); } catch { return id; } }) } }, { projection: { username: 1, displayName: 1 } }).toArray()
    : [];
  const names = new Map(users.map((user) => [String(user._id), user.username || user.displayName || String(user._id)]));
  const byMatch = new Map<string, any[]>();
  for (const prediction of predictions) byMatch.set(prediction.matchId, [...(byMatch.get(prediction.matchId) || []), prediction]);
  const rows = eligible.map((match) => ({
    matchId: match.providerMatchId,
    kickoffAt: new Date(match.kickoffAt).toISOString(),
    leagueCode: match.leagueCode,
    home: match.homeTeam?.name,
    away: match.awayTeam?.name,
    predictions: (byMatch.get(String(match.providerMatchId)) || []).map((prediction) => ({
      userId: String(prediction.userId),
      username: names.get(String(prediction.userId)) || "Unknown user",
      score: `${prediction.homeGoals}-${prediction.awayGoals}`,
      createdAt: prediction.createdAt ? new Date(prediction.createdAt).toISOString() : null,
    })),
  }));
  console.log(JSON.stringify({
    date: dateKey,
    timezone,
    totalMatchesToday: matches.length,
    leaderboardMatchesToday: eligible.length,
    leaderboardPredictions: predictions.length,
    uniqueUsers: userIds.length,
    users: userIds.map((id) => ({ userId: id, username: names.get(id) || "Unknown user", matches: predictions.filter((p) => String(p.userId) === id).length })),
    matches: rows,
  }, null, 2));
  await closeMongo();
}

main().catch(async (error) => { console.error(error); await closeMongo(); process.exitCode = 1; });
