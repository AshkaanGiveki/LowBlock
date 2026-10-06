import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined)
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnv();
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured");

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
const now = new Date();
const end = new Date(now);
const start = new Date(now.getTime() - 48 * 60 * 60 * 1000);

async function main() {
  await client.connect();
  const db = client.db();
  const matches = await db.collection<any>("matches").find({
    provider: "football-api",
    kickoffAt: { $gte: start, $lt: end },
  }, { projection: { providerMatchId: 1, kickoffAt: 1, status: 1, homeGoals: 1, awayGoals: 1, homeTeam: 1, awayTeam: 1 } }).toArray();
  const ids = matches.map((match) => String(match.providerMatchId));
  const predictionRows = await db.collection<any>("predictions").find({ matchId: { $in: ids }, userId: { $ne: "guest" } }, { projection: { _id: 1, userId: 1, matchId: 1 } }).toArray();
  const predictions = predictionRows.length;
  const scores = await db.collection<any>("predictionScores").countDocuments({ matchId: { $in: ids } });
  const snapshots = await db.collection<any>("predictionLockSnapshots").countDocuments({ matchId: { $in: ids } });
  const latestRuns = await db.collection<any>("syncRuns").find({ provider: "football-api" }, { projection: { startedAt: 1, finishedAt: 1, status: 1, error: 1, fixturesUpdated: 1, scoreEngine: 1 }, sort: { startedAt: -1 }, limit: 5 }).toArray();
  const quota = await db.collection<any>("footballApiQuota").findOne({ day: now.toISOString().slice(0, 10) });
  const requestSummary = await db.collection<any>("footballApiRequests").aggregate([
    { $match: { startedAt: { $gte: start } } },
    { $group: { _id: { path: "$path", status: "$status" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
  const runSummary = latestRuns.map((run) => ({ startedAt: run.startedAt, status: run.status, error: run.error, scoreEngine: run.scoreEngine, leaderboardEngine: run.leaderboardEngine }));
  console.log(JSON.stringify({ now, window: { start, end }, matches, predictions, scores, snapshots, runSummary, quota, requestSummary }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => client.close());
