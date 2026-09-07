import { ObjectId, type Db } from "mongodb";
import { rankRows, type Rankable } from "@/lib/domain/ranking";
import { getIranWeeklyPeriod } from "@/lib/domain/leaderboardPeriods";
import { getDefendingChampionUserId } from "@/lib/awards/defendingChampion";
import { DEFAULT_CLUB_LEAGUE_CODES, GLOBAL_LEAGUE_CODES } from "@/lib/football/leagues";

export type LeaderboardScope = { clubId?: string | null; seasonStartYear?: number | null; leagueCode?: string | null; matchday?: number | null; weekly?: boolean; weeklyOffset?: number };
export type LeaderboardRow = Rankable & { avatarUrl: string | null; isDefendingChampion: boolean; rank: number };

type MaterializedRow = {
  userId: string;
  scope: string;
  points?: number;
  exact?: number;
  correctOutcome?: number;
  globalPoints?: number;
  earliestPredictionAt?: Date | number;
  predictions?: number;
};

function materializedScope(scope: LeaderboardScope) {
  if (scope.weekly) return null;
  // Season/global and club-overall totals cannot safely use a materialized row:
  // their eligible competitions are configuration-driven. Global inclusion can
  // change, and each club can select a different set of competitions. Rebuild
  // those scopes from predictionScores so the league filter is applied at read
  // time instead of trusting potentially stale aggregate rows.
  if (!scope.leagueCode) return null;
  if (scope.clubId) return scope.leagueCode
    ? `CLUB:${scope.clubId}:LEAGUE:${scope.leagueCode}:${scope.seasonStartYear}`
    : scope.matchday != null
      ? `CLUB:${scope.clubId}:ROUND:${scope.leagueCode ?? ""}:${scope.seasonStartYear}:${scope.matchday}`
      : `CLUB:${scope.clubId}:OVERALL:${scope.seasonStartYear}`;
  if (scope.leagueCode) return scope.matchday != null
    ? `ROUND:${scope.leagueCode}:${scope.seasonStartYear}:${scope.matchday}`
    : `LEAGUE:${scope.leagueCode}:${scope.seasonStartYear}`;
  if (scope.matchday != null) return `ROUND:${scope.leagueCode ?? ""}:${scope.seasonStartYear}:${scope.matchday}`;
  if (scope.seasonStartYear != null) return `SEASON:${scope.seasonStartYear}`;
  return "GLOBAL";
}

async function getMaterializedLeaderboard(db: Db, scope: LeaderboardScope, limit: number, cursor?: { points: number; exact: number; correctOutcome?: number; globalPoints?: number; earliestPredictionAt?: number; predictions: number; userId: string }) {
  const scopeKey = materializedScope(scope);
  if (!scopeKey) return null;
  const filter: any = { scope: scopeKey };
  if (cursor) filter.$or = [
    { points: { $lt: cursor.points } },
    { points: cursor.points, exact: { $lt: cursor.exact } },
    { points: cursor.points, exact: cursor.exact, correctOutcome: { $lt: cursor.correctOutcome ?? 0 } },
    { points: cursor.points, exact: cursor.exact, predictions: { $lt: cursor.predictions } },
    { points: cursor.points, exact: cursor.exact, predictions: cursor.predictions, userId: { $gt: cursor.userId } },
  ];
  const rows = await db.collection<MaterializedRow>("leaderboardStats").find(filter, { projection: { _id: 0, userId: 1, scope: 1, points: 1, exact: 1, correctOutcome: 1, globalPoints: 1, earliestPredictionAt: 1, predictions: 1 } }).sort({ points: -1, exact: -1, correctOutcome: -1, globalPoints: -1, earliestPredictionAt: 1, predictions: -1, userId: 1 }).limit(Math.min(Math.max(limit, 1), 100)).toArray();
  if (!rows.length) return null;
  const ids = rows.map(row => String(row.userId)).filter(ObjectId.isValid).map(id => new ObjectId(id));
  const users = ids.length ? await db.collection<any>("users").find({ _id: { $in: ids } }, { projection: { username: 1, avatarUrl: 1 } }).toArray() : [];
  const byId = new Map(users.map(user => [String(user._id), user]));
  const championId = await getDefendingChampionUserId(db);
  return rows.map(row => ({ userId: String(row.userId), points: Number(row.points ?? 0), exact: Number(row.exact ?? 0), correctOutcome: Number(row.correctOutcome ?? 0), globalPoints: Number(row.globalPoints ?? 0), earliestPredictionAt: row.earliestPredictionAt ? new Date(row.earliestPredictionAt).getTime() : undefined, predictions: Number(row.predictions ?? 0), username: byId.get(String(row.userId))?.username ?? "LowBlock Player", avatarUrl: byId.get(String(row.userId))?.avatarUrl ?? null, isDefendingChampion: String(row.userId) === championId }));
}

function scoreMatch(scope: LeaderboardScope) {
  return {
    ...(scope.clubId ? { clubIdAtLock: scope.clubId } : {}),
    ...(scope.seasonStartYear != null ? { seasonStartYear: scope.seasonStartYear } : {}),
    ...(scope.leagueCode ? { leagueCode: scope.leagueCode } : {}),
    ...(scope.matchday != null ? { matchday: scope.matchday } : {}),
  };
}

export async function getCanonicalLeaderboard(db: Db, scope: LeaderboardScope, limit = 100, cursor?: { points: number; exact: number; correctOutcome?: number; globalPoints?: number; earliestPredictionAt?: number; predictions: number; userId: string }) {
  const materialized = await getMaterializedLeaderboard(db, scope, limit, cursor);
  if (materialized) return rankRows(materialized).map(row => ({ ...row, cursor: { points: row.points, exact: row.exact, correctOutcome: row.correctOutcome, globalPoints: row.globalPoints, earliestPredictionAt: row.earliestPredictionAt, predictions: row.predictions, userId: row.userId } }));
  let allowedClubCodes: string[] | null = null;
  if (scope.clubId) {
    const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(scope.clubId) }, { projection: { leaderboardCompetitionCodes: 1 } });
    allowedClubCodes = Array.isArray(club?.leaderboardCompetitionCodes) ? club.leaderboardCompetitionCodes : DEFAULT_CLUB_LEAGUE_CODES;
  }
  const period = scope.weekly ? getIranWeeklyPeriod(new Date(), scope.weeklyOffset ?? 0) : null;
  const pipeline: any[] = [];
  if (period) pipeline.push(
    { $lookup: { from: "matches", localField: "matchId", foreignField: "providerMatchId", as: "fixture" } },
    { $unwind: "$fixture" },
    { $match: { "fixture.kickoffAt": { $gte: period.start, $lt: period.end } } },
  );
  pipeline.push(
    ...(allowedClubCodes ? [{ $match: { leagueCode: { $in: allowedClubCodes } } }] : (!scope.clubId && !scope.leagueCode && !scope.matchday ? [{ $match: { leagueCode: { $in: GLOBAL_LEAGUE_CODES } } }] : [])),
    { $lookup: { from: "predictions", let: { uid: "$userId", mid: "$matchId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$uid"] }, { $eq: ["$matchId", "$$mid"] }] } } }, { $project: { createdAt: 1 } }], as: "prediction" } },
    { $unwind: { path: "$prediction", preserveNullAndEmptyArrays: true } },
    { $match: scoreMatch(scope) },
    { $group: { _id: "$userId", points: { $sum: "$points" }, exact: { $sum: { $cond: ["$exactScore", 1, 0] } }, correctOutcome: { $sum: { $cond: ["$correctOutcome", 1, 0] } }, predictions: { $sum: 1 }, earliestPredictionAt: { $min: "$prediction.createdAt" } } },
  );
  if (cursor) pipeline.push({ $match: { $or: [{ points: { $lt: cursor.points } }, { points: cursor.points, exact: { $lt: cursor.exact } }, { points: cursor.points, exact: cursor.exact, predictions: { $lt: cursor.predictions } }, { points: cursor.points, exact: cursor.exact, predictions: cursor.predictions, _id: { $gt: cursor.userId } }] } });
  pipeline.push(
    { $sort: { points: -1, exact: -1, predictions: -1, _id: 1 } },
    { $limit: Math.min(Math.max(limit, 1), 100) },
  );
  const rows = await db.collection("predictionScores").aggregate(pipeline).toArray();
  const globalIds = rows.map(row => String(row._id));
  const globalRows = globalIds.length ? await db.collection<any>("leaderboardStats").find({ userId: { $in: globalIds }, scope: "GLOBAL" }, { projection: { userId: 1, points: 1 } }).toArray() : [];
  const globalPoints = new Map(globalRows.map(row => [String(row.userId), Number(row.points ?? 0)]));
  const ids = rows.map(row => String(row._id)).filter(ObjectId.isValid).map(id => new ObjectId(id));
  const users = ids.length ? await db.collection<{ username?: string; avatarUrl?: string | null }>("users").find({ _id: { $in: ids } }, { projection: { username: 1, avatarUrl: 1 } }).toArray() : [];
  const byId = new Map(users.map(user => [String(user._id), user]));
  const championId = await getDefendingChampionUserId(db);
  const mapped = rows.map(row => ({ userId: String(row._id), points: Number(row.points ?? 0), exact: Number(row.exact ?? 0), correctOutcome: Number(row.correctOutcome ?? 0), globalPoints: globalPoints.get(String(row._id)) ?? 0, earliestPredictionAt: row.earliestPredictionAt ? new Date(row.earliestPredictionAt).getTime() : undefined, predictions: Number(row.predictions ?? 0), username: byId.get(String(row._id))?.username ?? "LowBlock Player", avatarUrl: byId.get(String(row._id))?.avatarUrl ?? null, isDefendingChampion: String(row._id) === championId }));
  return rankRows(mapped).map(row => ({ ...row, cursor: { points: row.points, exact: row.exact, predictions: row.predictions, userId: row.userId } }));
}

export async function getLeaderboardSummary(db: Db, userId: string, scope: LeaderboardScope) {
  const scopeKey = materializedScope(scope);
  if (!scopeKey) {
    const legacy = await getCanonicalLeaderboard(db, scope, 1000);
    const row = legacy.find(item => item.userId === userId);
    return row ? { userId, rank: row.rank, points: row.points, exact: row.exact, correctOutcome: row.correctOutcome ?? 0, predictions: row.predictions, scope: "FILTERED" } : null;
  }
  const stats = await db.collection<MaterializedRow>("leaderboardStats").findOne({ userId, scope: scopeKey }, { projection: { _id: 0, userId: 1, points: 1, exact: 1, correctOutcome: 1, globalPoints: 1, earliestPredictionAt: 1, predictions: 1 } });
  if (!stats) { const legacy = await getCanonicalLeaderboard(db, scope, 1000); const row = legacy.find(item => item.userId === userId); return row ? { userId, rank: row.rank, points: row.points, exact: row.exact, correctOutcome: row.correctOutcome ?? 0, predictions: row.predictions, scope: scopeKey } : null; }
  const better = await db.collection<MaterializedRow>("leaderboardStats").countDocuments({ scope: scopeKey, $or: [
    { points: { $gt: stats.points ?? 0 } },
    { points: stats.points ?? 0, exact: { $gt: stats.exact ?? 0 } },
    { points: stats.points ?? 0, exact: stats.exact ?? 0, correctOutcome: { $gt: stats.correctOutcome ?? 0 } },
    { points: stats.points ?? 0, exact: stats.exact ?? 0, correctOutcome: stats.correctOutcome ?? 0, globalPoints: { $gt: stats.globalPoints ?? 0 } },
    { points: stats.points ?? 0, exact: stats.exact ?? 0, correctOutcome: stats.correctOutcome ?? 0, globalPoints: stats.globalPoints ?? 0, earliestPredictionAt: { $lt: stats.earliestPredictionAt ?? new Date(8640000000000000) } },
    { points: stats.points ?? 0, exact: stats.exact ?? 0, correctOutcome: stats.correctOutcome ?? 0, globalPoints: stats.globalPoints ?? 0, earliestPredictionAt: stats.earliestPredictionAt ?? new Date(8640000000000000), predictions: { $gt: stats.predictions ?? 0 } },
    { points: stats.points ?? 0, exact: stats.exact ?? 0, correctOutcome: stats.correctOutcome ?? 0, globalPoints: stats.globalPoints ?? 0, earliestPredictionAt: stats.earliestPredictionAt ?? new Date(8640000000000000), predictions: stats.predictions ?? 0, userId: { $lt: userId } },
  ] });
  return { userId, rank: better + 1, points: Number(stats.points ?? 0), exact: Number(stats.exact ?? 0), correctOutcome: Number(stats.correctOutcome ?? 0), predictions: Number(stats.predictions ?? 0), scope: scopeKey };
}
