import { ObjectId, type Db } from "mongodb";
import { rankRows, type Rankable } from "@/lib/domain/ranking";
import { getIranWeeklyPeriod } from "@/lib/domain/leaderboardPeriods";
import { getDefendingChampionUserId } from "@/lib/awards/defendingChampion";

export type LeaderboardScope = { clubId?: string | null; seasonStartYear?: number | null; leagueCode?: string | null; matchday?: number | null; weekly?: boolean; weeklyOffset?: number };
export type LeaderboardRow = Rankable & { avatarUrl: string | null; isDefendingChampion: boolean; rank: number };

function scoreMatch(scope: LeaderboardScope) {
  return {
    ...(scope.clubId ? { clubIdAtLock: scope.clubId } : {}),
    ...(scope.seasonStartYear != null ? { seasonStartYear: scope.seasonStartYear } : {}),
    ...(scope.leagueCode ? { leagueCode: scope.leagueCode } : {}),
    ...(scope.matchday != null ? { matchday: scope.matchday } : {}),
  };
}

export async function getCanonicalLeaderboard(db: Db, scope: LeaderboardScope, limit = 100, cursor?: { points: number; exact: number; predictions: number; userId: string }) {
  const period = scope.weekly ? getIranWeeklyPeriod(new Date(), scope.weeklyOffset ?? 0) : null;
  const pipeline: any[] = [];
  if (period) pipeline.push(
    { $lookup: { from: "matches", localField: "matchId", foreignField: "providerMatchId", as: "fixture" } },
    { $unwind: "$fixture" },
    { $match: { "fixture.kickoffAt": { $gte: period.start, $lt: period.end } } },
  );
  pipeline.push(
    { $match: scoreMatch(scope) },
    { $group: { _id: "$userId", points: { $sum: "$points" }, exact: { $sum: { $cond: ["$exactScore", 1, 0] } }, predictions: { $sum: 1 } } },
  );
  if (cursor) pipeline.push({ $match: { $or: [{ points: { $lt: cursor.points } }, { points: cursor.points, exact: { $lt: cursor.exact } }, { points: cursor.points, exact: cursor.exact, predictions: { $lt: cursor.predictions } }, { points: cursor.points, exact: cursor.exact, predictions: cursor.predictions, _id: { $gt: cursor.userId } }] } });
  pipeline.push(
    { $sort: { points: -1, exact: -1, predictions: -1, _id: 1 } },
    { $limit: Math.min(Math.max(limit, 1), 100) },
  );
  const rows = await db.collection("predictionScores").aggregate(pipeline).toArray();
  const ids = rows.map(row => String(row._id)).filter(ObjectId.isValid).map(id => new ObjectId(id));
  const users = ids.length ? await db.collection<{ username?: string; avatarUrl?: string | null }>("users").find({ _id: { $in: ids } }, { projection: { username: 1, avatarUrl: 1 } }).toArray() : [];
  const byId = new Map(users.map(user => [String(user._id), user]));
  const championId = await getDefendingChampionUserId(db);
  const mapped = rows.map(row => ({ userId: String(row._id), points: Number(row.points ?? 0), exact: Number(row.exact ?? 0), predictions: Number(row.predictions ?? 0), username: byId.get(String(row._id))?.username ?? "LowBlock Player", avatarUrl: byId.get(String(row._id))?.avatarUrl ?? null, isDefendingChampion: String(row._id) === championId }));
  return rankRows(mapped).map(row => ({ ...row, cursor: { points: row.points, exact: row.exact, predictions: row.predictions, userId: row.userId } }));
}
