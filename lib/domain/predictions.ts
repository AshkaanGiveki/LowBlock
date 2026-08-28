import type { Db } from "mongodb";
export async function upsertPrediction(db: Db, userId: string, prediction: { matchId: string; homeGoals: number; awayGoals: number }) { const now = new Date(); return db.collection("predictions").updateOne({ userId, matchId: prediction.matchId }, { $set: { ...prediction, userId, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); }
