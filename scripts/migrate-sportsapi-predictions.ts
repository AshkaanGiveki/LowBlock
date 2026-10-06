import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { runLeaderboardEngine, runScoreEngine } from "../lib/scoring/scoreEngine";

if (existsSync(".env.local")) for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });

function teamKey(value: unknown) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function sameTeam(a: unknown, b: unknown) {
  const left = teamKey(a); const right = teamKey(b);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

async function main() {
  const apply = process.argv.includes("--apply");
  await client.connect();
  const db = client.db();
  const sourceMatches = await db.collection<any>("matches").find({ provider: "sportsapi" }).toArray();
  const targetMatches = await db.collection<any>("matches").find({ provider: "football-api" }).toArray();
  const sourceIds = sourceMatches.map((row) => String(row.providerMatchId));
  const predictions = await db.collection<any>("predictions").find({ matchId: { $in: sourceIds }, userId: { $ne: "guest" } }).toArray();
  const targetBySource = new Map<string, any>();
  const unmatched: any[] = [];
  for (const source of sourceMatches) {
    const candidates = targetMatches.filter((target) =>
      target.leagueCode === source.leagueCode &&
      Math.abs(new Date(target.kickoffAt).getTime() - new Date(source.kickoffAt).getTime()) <= 6 * 60 * 60 * 1000 &&
      sameTeam(target.homeTeam?.name, source.homeTeam?.name) &&
      sameTeam(target.awayTeam?.name, source.awayTeam?.name),
    );
    candidates.sort((a, b) => Math.abs(new Date(a.kickoffAt).getTime() - new Date(source.kickoffAt).getTime()) - Math.abs(new Date(b.kickoffAt).getTime() - new Date(source.kickoffAt).getTime()));
    if (candidates[0]) targetBySource.set(String(source.providerMatchId), candidates[0]);
    else if (predictions.some((prediction) => String(prediction.matchId) === String(source.providerMatchId))) unmatched.push({ sourceId: source.providerMatchId, leagueCode: source.leagueCode, kickoffAt: source.kickoffAt, home: source.homeTeam?.name, away: source.awayTeam?.name });
  }
  const migrations = predictions.map((prediction) => ({ prediction, source: String(prediction.matchId), target: targetBySource.get(String(prediction.matchId)) })).filter((row) => row.target);
  const duplicates: any[] = [];
  let moved = 0;
  if (apply) {
    for (const row of migrations) {
      const targetId = String(row.target.providerMatchId);
      const existing = await db.collection<any>("predictions").findOne({ userId: row.prediction.userId, matchId: targetId, _id: { $ne: row.prediction._id } });
      if (existing) {
        duplicates.push({ userId: row.prediction.userId, source: row.source, target: targetId, kept: String(existing._id) });
        await db.collection("predictionScores").deleteMany({ userId: row.prediction.userId, matchId: row.source });
        await db.collection("predictionLockSnapshots").deleteMany({ predictionId: String(row.prediction._id) });
        await db.collection("predictions").deleteOne({ _id: row.prediction._id });
        continue;
      }
      await db.collection("predictions").updateOne({ _id: row.prediction._id }, { $set: { matchId: targetId, migratedFromProvider: "sportsapi", migratedAt: new Date() } });
      await db.collection("predictionScores").updateMany({ userId: row.prediction.userId, matchId: row.source }, { $set: { matchId: targetId, fixtureId: targetId, migratedFromProvider: "sportsapi", migratedAt: new Date() } });
      await db.collection("predictionLockSnapshots").updateMany({ predictionId: String(row.prediction._id) }, { $set: { matchId: targetId, migratedFromProvider: "sportsapi", migratedAt: new Date() } });
      moved++;
    }
    if (moved > 0 || duplicates.length > 0) {
      await runScoreEngine();
      await runLeaderboardEngine();
    }
  }
  console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", sourceMatches: sourceMatches.length, sportsApiPredictions: predictions.length, matchedPredictions: migrations.length, moved, duplicatePredictions: duplicates.length, unmatched, duplicates }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => client.close());
