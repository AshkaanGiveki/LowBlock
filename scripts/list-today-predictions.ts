import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { MongoClient, ObjectId } from "mongodb";

if (existsSync(".env.local")) for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

async function main() {
  await client.connect();
  const db = client.db();
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = new Date(`${date}T00:00:00+03:30`);
  const end = new Date(start.getTime() + 86_400_000);
  const matches = await db.collection<any>("matches").find({ kickoffAt: { $gte: start, $lt: end }, provider: { $in: ["sportsapi", "football-api"] } }, { projection: { provider: 1, providerMatchId: 1, leagueCode: 1, kickoffAt: 1, status: 1, homeGoals: 1, awayGoals: 1, homeTeam: 1, awayTeam: 1 } }).sort({ kickoffAt: 1 }).toArray();
  const matchIds = matches.map((match) => String(match.providerMatchId));
  const predictions = await db.collection<any>("predictions").find({ matchId: { $in: matchIds }, userId: { $ne: "guest" } }, { projection: { userId: 1, matchId: 1, homeGoals: 1, awayGoals: 1, createdAt: 1, updatedAt: 1 } }).sort({ createdAt: 1 }).toArray();
  const userIds = [...new Set(predictions.map((prediction) => String(prediction.userId)))];
  const users = await db.collection<any>("users").find({ _id: { $in: userIds.filter((id) => /^[a-f0-9]{24}$/i.test(id)).map((id) => new ObjectId(id)) } }, { projection: { username: 1, displayName: 1 } }).toArray();
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const scoreRows = await db.collection<any>("predictionScores").find({ matchId: { $in: matchIds }, userId: { $ne: "guest" } }, { projection: { userId: 1, matchId: 1, points: 1, category: 1 } }).toArray();
  const scoreMap = new Map(scoreRows.map((row) => [`${row.userId}:${row.matchId}`, row]));
  const matchMap = new Map(matches.map((match) => [String(match.providerMatchId), match]));
  const rows = predictions.map((prediction) => {
    const match = matchMap.get(String(prediction.matchId));
    const user = userMap.get(String(prediction.userId));
    const score = scoreMap.get(`${prediction.userId}:${prediction.matchId}`);
    return {
      userId: prediction.userId,
      username: user?.username ?? user?.displayName ?? "Unknown user",
      provider: match?.provider,
      matchId: prediction.matchId,
      leagueCode: match?.leagueCode,
      kickoffAt: match?.kickoffAt,
      home: match?.homeTeam?.name,
      away: match?.awayTeam?.name,
      prediction: `${prediction.homeGoals}-${prediction.awayGoals}`,
      result: match?.homeGoals != null && match?.awayGoals != null ? `${match.homeGoals}-${match.awayGoals}` : null,
      points: score?.points ?? null,
      category: score?.category ?? null,
      createdAt: prediction.createdAt ?? prediction.updatedAt ?? null,
    };
  });
  const report = { date, window: { start, end }, matches: matches.length, predictions: rows.length, rows };
  writeFileSync(`data/today-predictions-${date}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ date, matches: matches.length, predictions: rows.length, report: `data/today-predictions-${date}.json` }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => client.close());
