import { getDb } from "@/lib/db/mongo";
import { calculatePredictionScore } from "@/lib/scoring/calculatePredictionScore";
import { createLockSnapshot, isPredictionLocked, SCORING_VERSION } from "@/lib/domain/predictionLock";

type Match = { _id?: unknown; providerMatchId: string; leagueCode: string; seasonStartYear: number; matchday: number; roundId?: string | null; status: string; kickoffAt: Date; homeGoals: number | null; awayGoals: number | null };
type Prediction = { _id?: unknown; userId: string; matchId: string; homeGoals: number; awayGoals: number };

/**
 * The only write path for prediction scores. It is safe to run repeatedly:
 * each score is replaced for the same prediction/match and stats are rebuilt
 * from the canonical score rows rather than incremented.
 */
export async function runScoreEngine() {
  const db = await getDb();
  const matches = await db.collection<Match>("matches").find({ provider: "football-api", status: "FINISHED", homeGoals: { $ne: null }, awayGoals: { $ne: null } }).toArray();
  if (!matches.length) return { matches: 0, scores: 0, leaderboards: 0 };
  const byMatch = new Map(matches.map(match => [match.providerMatchId, match]));
  const predictions = await db.collection<Prediction>("predictions").find({ matchId: { $in: matches.map(match => match.providerMatchId) }, userId: { $ne: "guest" } }).toArray();
  const now = new Date();
  const snapshots = new Map<string, Awaited<ReturnType<typeof createLockSnapshot>>>();
  for (const prediction of predictions) {
    if (!isPredictionLocked(byMatch.get(prediction.matchId)!)) continue;
    snapshots.set(`${prediction.userId}:${prediction.matchId}`, await createLockSnapshot(db, prediction, new Date(byMatch.get(prediction.matchId)!.kickoffAt)));
  }
  const scoreOps = predictions.map(prediction => {
    const match = byMatch.get(prediction.matchId)!;
    const score = calculatePredictionScore(prediction.homeGoals, prediction.awayGoals, match.homeGoals, match.awayGoals);
    const snapshot = snapshots.get(`${prediction.userId}:${prediction.matchId}`);
    return { updateOne: { filter: { userId: prediction.userId, matchId: prediction.matchId }, update: { $set: { predictionId: String(prediction._id ?? `${prediction.userId}:${prediction.matchId}`), fixtureId: match.providerMatchId, matchId: match.providerMatchId, userId: prediction.userId, leagueCode: match.leagueCode, seasonId: String(match.seasonStartYear), seasonStartYear: match.seasonStartYear, roundId: match.roundId ?? null, matchday: match.matchday, points: score.points, category: score.category, exactScore: score.category === "EXACT_SCORE", correctOutcome: ["EXACT_SCORE", "CORRECT_GOAL_DIFFERENCE", "CORRECT_OUTCOME"].includes(score.category), predictedHomeGoals: prediction.homeGoals, predictedAwayGoals: prediction.awayGoals, actualHomeGoals: match.homeGoals, actualAwayGoals: match.awayGoals, clubIdAtLock: snapshot?.clubIdAtLock ?? null, scoringVersion: SCORING_VERSION, calculatedAt: now, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true } };
  });
  if (scoreOps.length) await db.collection("predictionScores").bulkWrite(scoreOps, { ordered: false });
  const aggregates = new Map<string, { userId: string; scope: string; points: number; predictions: number; exact: number }>();
  for (const prediction of predictions) {
    const match = byMatch.get(prediction.matchId)!;
    const score = calculatePredictionScore(prediction.homeGoals, prediction.awayGoals, match.homeGoals, match.awayGoals);
    const snapshot = snapshots.get(`${prediction.userId}:${prediction.matchId}`);
    const scopes = [`LEAGUE:${match.leagueCode}:${match.seasonStartYear}`, `ROUND:${match.leagueCode}:${match.seasonStartYear}:${match.matchday}`, `SEASON:${match.seasonStartYear}`, "GLOBAL"];
    if (snapshot?.clubIdAtLock) scopes.push(`CLUB:${snapshot.clubIdAtLock}:OVERALL:${match.seasonStartYear}`, `CLUB:${snapshot.clubIdAtLock}:LEAGUE:${match.leagueCode}:${match.seasonStartYear}`, `CLUB:${snapshot.clubIdAtLock}:ROUND:${match.leagueCode}:${match.seasonStartYear}:${match.matchday}`);
    for (const scope of scopes) { const key = `${prediction.userId}:${scope}`; const row = aggregates.get(key) ?? { userId: prediction.userId, scope, points: 0, predictions: 0, exact: 0 }; row.points += score.points; row.predictions++; row.exact += score.category === "EXACT_SCORE" ? 1 : 0; aggregates.set(key, row); }
  }
  const statOps = [...aggregates.values()].map(row => ({ updateOne: { filter: { userId: row.userId, scope: row.scope }, update: { $set: { ...row, totalPoints: row.points, predictionCount: row.predictions, exactScores: row.exact, updatedAt: now } }, upsert: true } }));
  if (statOps.length) await db.collection("leaderboardStats").bulkWrite(statOps, { ordered: false });
  return { matches: matches.length, scores: scoreOps.length, leaderboards: aggregates.size };
}

