import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { calculatePredictionScore } from "../lib/scoring/calculatePredictionScore";
import { isGlobalCompetition } from "../lib/football/leagues";

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
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const matches = await db.collection<any>("matches").find({ provider: "football-api", kickoffAt: { $gte: cutoff }, status: "FINISHED", homeGoals: { $ne: null }, awayGoals: { $ne: null } }, { projection: { providerMatchId: 1, leagueCode: 1, seasonStartYear: 1, matchday: 1, roundId: 1, kickoffAt: 1, homeGoals: 1, awayGoals: 1 } }).toArray();
  const ids = matches.map((m) => String(m.providerMatchId));
  const byId = new Map(matches.map((m) => [String(m.providerMatchId), m]));
  const predictions = await db.collection<any>("predictions").find({ matchId: { $in: ids }, userId: { $ne: "guest" } }, { projection: { _id: 1, userId: 1, matchId: 1, homeGoals: 1, awayGoals: 1 } }).toArray();
  const now = new Date();
  const ops = predictions.map((p) => {
    const m = byId.get(String(p.matchId));
    const score = calculatePredictionScore(p.homeGoals, p.awayGoals, m.homeGoals, m.awayGoals);
    return { updateOne: { filter: { userId: p.userId, matchId: p.matchId }, update: { $set: { predictionId: String(p._id ?? `${p.userId}:${p.matchId}`), fixtureId: String(p.matchId), matchId: String(p.matchId), userId: p.userId, leagueCode: m.leagueCode, seasonId: String(m.seasonStartYear), seasonStartYear: m.seasonStartYear, roundId: m.roundId ?? null, matchday: m.matchday, kickoffAt: m.kickoffAt, points: score.points, category: score.category, exactScore: score.category === "EXACT_SCORE", correctOutcome: ["EXACT_SCORE", "CORRECT_GOAL_DIFFERENCE", "CORRECT_OUTCOME"].includes(score.category), predictedHomeGoals: p.homeGoals, predictedAwayGoals: p.awayGoals, actualHomeGoals: m.homeGoals, actualAwayGoals: m.awayGoals, globalEligible: isGlobalCompetition(m.leagueCode), calculatedAt: now, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true } };
  });
  if (ops.length) await db.collection("predictionScores").bulkWrite(ops, { ordered: false });
  const users = [...new Set(predictions.map((p) => String(p.userId)))];
  const rows = await db.collection<any>("predictionScores").find({ userId: { $in: users } }, { projection: { userId: 1, leagueCode: 1, points: 1, exactScore: 1, correctOutcome: 1 } }).toArray();
  const totals = new Map<string, any>();
  for (const row of rows) if (isGlobalCompetition(row.leagueCode)) {
    const total = totals.get(row.userId) ?? { points: 0, predictions: 0, exact: 0, correctOutcome: 0 };
    total.points += Number(row.points ?? 0); total.predictions++; total.exact += row.exactScore ? 1 : 0; total.correctOutcome += row.correctOutcome ? 1 : 0; totals.set(row.userId, total);
  }
  const statOps = [...totals.entries()].map(([userId, total]) => ({ updateOne: { filter: { userId, scope: "GLOBAL" }, update: { $set: { userId, scope: "GLOBAL", points: total.points, totalPoints: total.points, predictions: total.predictions, predictionCount: total.predictions, exact: total.exact, exactScores: total.exact, correctOutcome: total.correctOutcome, updatedAt: now } }, upsert: true } }));
  if (statOps.length) await db.collection("leaderboardStats").bulkWrite(statOps, { ordered: false });
  console.log(JSON.stringify({ matches: matches.length, predictions: predictions.length, scoresUpdated: ops.length, globalUsersUpdated: statOps.length }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => client.close());
