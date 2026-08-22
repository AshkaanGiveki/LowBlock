import type { Db } from "mongodb";
import type { ClubMembershipRecord, PredictionLockSnapshot } from "@/lib/domain/types";

export const SCORING_VERSION = "lowblock-v1";

export function predictionDeadline(kickoffAt: Date | string) {
  return new Date(kickoffAt);
}

export function isPredictionLocked(match: { kickoffAt: Date | string; status?: string }, now = new Date()) {
  if (["VOID", "CANCELLED"].includes(String(match.status))) return true;
  return now.getTime() >= predictionDeadline(match.kickoffAt).getTime();
}

export async function activeMembershipAt(db: Db, userId: string, at: Date) {
  return db.collection<ClubMembershipRecord>("clubMemberships").findOne({
    userId,
    joinedAt: { $lte: at },
    $or: [{ leftAt: null }, { leftAt: { $gt: at } }],
  }, { sort: { joinedAt: -1 } });
}

export async function createLockSnapshot(db: Db, prediction: { _id?: unknown; userId: string; matchId: string; homeGoals: number; awayGoals: number }, lockedAt = new Date()) {
  const predictionId = String(prediction._id ?? `${prediction.userId}:${prediction.matchId}`);
  const existing = await db.collection<PredictionLockSnapshot>("predictionLockSnapshots").findOne({ predictionId });
  if (existing) return existing;
  const membership = await activeMembershipAt(db, prediction.userId, lockedAt);
  const snapshot: PredictionLockSnapshot = {
    predictionId,
    userId: prediction.userId,
    matchId: prediction.matchId,
    predictedHomeGoals: prediction.homeGoals,
    predictedAwayGoals: prediction.awayGoals,
    clubIdAtLock: membership?.clubId ?? null,
    membershipIdAtLock: membership?._id ? String(membership._id) : null,
    lockedAt,
  };
  try {
    await db.collection("predictionLockSnapshots").insertOne(snapshot as Omit<PredictionLockSnapshot, "_id">);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000)) throw error;
  }
  return (await db.collection<PredictionLockSnapshot>("predictionLockSnapshots").findOne({ predictionId })) ?? snapshot;
}
