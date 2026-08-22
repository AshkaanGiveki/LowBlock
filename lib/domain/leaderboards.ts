import { ObjectId, type Db } from "mongodb";
import { rankRows, type Rankable } from "@/lib/domain/ranking";

export type LeaderboardScope = { clubId?: string | null; seasonStartYear?: number | null; leagueCode?: string | null; matchday?: number | null };
export type LeaderboardRow = Rankable & { avatarUrl: string | null; rank: number };

function scoreMatch(scope: LeaderboardScope) {
  return {
    ...(scope.clubId ? { clubIdAtLock: scope.clubId } : {}),
    ...(scope.seasonStartYear != null ? { seasonStartYear: scope.seasonStartYear } : {}),
    ...(scope.leagueCode ? { leagueCode: scope.leagueCode } : {}),
    ...(scope.matchday != null ? { matchday: scope.matchday } : {}),
  };
}

export async function getCanonicalLeaderboard(db: Db, scope: LeaderboardScope, limit = 100, cursor?: { points: number; exact: number; predictions: number; userId: string }) {
  const rows = await db.collection("predictionScores").aggregate([
    { $match: scoreMatch(scope) },
    { $group: { _id: "$userId", points: { $sum: "$points" }, exact: { $sum: { $cond: ["$exactScore", 1, 0] } }, predictions: { $sum: 1 } } },
    { $sort: { points: -1, exact: -1, predictions: -1, _id: 1 } },
    { $limit: Math.min(Math.max(limit, 1), 100) },
  ]).toArray();
  const ids = rows.map(row => String(row._id)).filter(ObjectId.isValid).map(id => new ObjectId(id));
  const users = ids.length ? await db.collection<{ username?: string; avatarUrl?: string | null }>("users").find({ _id: { $in: ids } }, { projection: { username: 1, avatarUrl: 1 } }).toArray() : [];
  const byId = new Map(users.map(user => [String(user._id), user]));
  const mapped = rows.map(row => ({ userId: String(row._id), points: Number(row.points ?? 0), exact: Number(row.exact ?? 0), predictions: Number(row.predictions ?? 0), username: byId.get(String(row._id))?.username ?? "LowBlock Player", avatarUrl: byId.get(String(row._id))?.avatarUrl ?? null }));
  return rankRows(mapped).map(row => ({ ...row, cursor: { points: row.points, exact: row.exact, predictions: row.predictions, userId: row.userId } }));
}

