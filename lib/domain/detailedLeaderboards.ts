import { ObjectId, type Db } from "mongodb";
import { getIranWeeklyPeriod } from "@/lib/domain/leaderboardPeriods";

export type DetailedSort = "rank" | "username" | "predictions" | "exact" | "correct" | "misses" | "points" | "average" | "awards";
export type DetailedScope = { clubId?: string | null; seasonStartYear?: number | null; weekly?: boolean; weeklyOffset?: number; page?: number; pageSize?: number; sort?: DetailedSort; direction?: "asc" | "desc"; viewerUserId?: string | null };
export type DetailedRow = { userId: string; username: string; avatarUrl: string | null; clubId: string | null; clubName: string | null; predictions: number; exact: number; correct: number; misses: number; points: number; average: number; awards: number; rank: number; previousRank: number | null; placeChange: number };

const sortFields: DetailedSort[] = ["rank", "username", "predictions", "exact", "correct", "misses", "points", "average", "awards"];
export function normalizeDetailedSort(value: string | null): DetailedSort { return sortFields.includes(value as DetailedSort) ? value as DetailedSort : "rank"; }

function iranDayStart(date: Date) {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return new Date(`${key}T00:00:00+03:30`);
}

function comparison(a: Omit<DetailedRow, "rank" | "previousRank" | "placeChange">, b: Omit<DetailedRow, "rank" | "previousRank" | "placeChange">, sort: DetailedSort, direction: "asc" | "desc") {
  const sign = direction === "asc" ? 1 : -1;
  const value = (row: typeof a): string | number => sort === "username" ? row.username.toLocaleLowerCase() : sort === "average" ? row.average : sort === "predictions" ? row.predictions : sort === "exact" ? row.exact : sort === "correct" ? row.correct : sort === "misses" ? row.misses : sort === "points" ? row.points : sort === "awards" ? row.awards : 0;
  if (sort === "rank") return b.points - a.points || b.exact - a.exact || b.correct - a.correct || a.username.localeCompare(b.username);
  const left = value(a); const right = value(b);
  return (typeof left === "string" ? left.localeCompare(right as string) : (left as number) - (right as number)) * sign || b.points - a.points || a.username.localeCompare(b.username);
}

async function aggregateRows(db: Db, scope: DetailedScope, cutoff: Date) {
  const period = scope.weekly ? getIranWeeklyPeriod(new Date(), scope.weeklyOffset ?? 0) : null;
  const match: Record<string, unknown> = { "fixture.kickoffAt": { $lt: cutoff } };
  if (period) match["fixture.kickoffAt"] = { $gte: period.start, $lt: new Date(Math.min(period.end.getTime(), cutoff.getTime())) };
  if (scope.seasonStartYear != null) match.seasonStartYear = scope.seasonStartYear;
  if (scope.clubId) match.clubIdAtLock = scope.clubId;
  const rows = await db.collection<any>("predictionScores").aggregate([
    { $lookup: { from: "matches", localField: "matchId", foreignField: "providerMatchId", as: "fixture" } },
    { $unwind: "$fixture" },
    { $match: match },
    { $group: { _id: "$userId", points: { $sum: "$points" }, predictions: { $sum: 1 }, exact: { $sum: { $cond: ["$exactScore", 1, 0] } }, correct: { $sum: { $cond: ["$correctOutcome", 1, 0] } } } },
  ]).toArray();
  const ids = rows.map(row => String(row._id));
  if (!ids.length) return [] as Array<Omit<DetailedRow, "rank" | "previousRank" | "placeChange">>;
  const objectIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
  const users = objectIds.length ? await db.collection<any>("users").find({ _id: { $in: objectIds } }, { projection: { username: 1, avatarUrl: 1 } }).toArray() : [];
  const userMap = new Map(users.map(user => [String(user._id), user]));
  const awards = await db.collection<any>("awards").aggregate([{ $match: { userId: { $in: ids }, ...(scope.clubId ? { scope: "CLUB", clubId: scope.clubId } : {}) } }, { $group: { _id: "$userId", count: { $sum: 1 } } }]).toArray();
  const awardMap = new Map(awards.map(row => [String(row._id), Number(row.count ?? 0)]));
  const memberships = await db.collection<any>("clubMemberships").find({ userId: { $in: ids }, leftAt: null }, { projection: { userId: 1, clubId: 1 } }).toArray();
  const clubIds = [...new Set(memberships.map(row => String(row.clubId)).filter(id => /^[a-f\d]{24}$/i.test(id)))];
  const clubs = clubIds.length ? await db.collection<any>("clubs").find({ _id: { $in: clubIds.map(id => new ObjectId(id)) } }, { projection: { name: 1 } }).toArray() : [];
  const clubMap = new Map(clubs.map(club => [String(club._id), club.name]));
  const memberMap = new Map(memberships.map(row => [String(row.userId), String(row.clubId)]));
  return rows.map(row => { const userId = String(row._id); const predictions = Number(row.predictions ?? 0); const points = Number(row.points ?? 0); const clubId = scope.clubId ?? memberMap.get(userId) ?? null; return { userId, username: userMap.get(userId)?.username ?? "LowBlock Player", avatarUrl: userMap.get(userId)?.avatarUrl ?? null, clubId, clubName: clubId ? clubMap.get(clubId) ?? null : null, predictions, exact: Number(row.exact ?? 0), correct: Number(row.correct ?? 0), misses: Math.max(0, predictions - Number(row.correct ?? 0)), points, average: predictions ? Number((points / predictions).toFixed(2)) : 0, awards: awardMap.get(userId) ?? 0 }; });
}

export async function getDetailedLeaderboard(db: Db, scope: DetailedScope) {
  const now = new Date(); const sort = scope.sort ?? "rank"; const direction = scope.direction ?? "desc"; const pageSize = Math.min(Math.max(scope.pageSize ?? 25, 10), 50); const page = Math.max(scope.page ?? 1, 1);
  const current = await aggregateRows(db, scope, now); const yesterday = await aggregateRows(db, scope, iranDayStart(now));
  const currentSorted = [...current].sort((a, b) => comparison(a, b, sort, direction)); const previousSorted = [...yesterday].sort((a, b) => comparison(a, b, sort, direction)); const previousRanks = new Map(previousSorted.map((row, index) => [row.userId, index + 1]));
  const ranked = currentSorted.map((row, index) => { const rank = index + 1; const previousRank = previousRanks.get(row.userId) ?? null; return { ...row, rank, previousRank, placeChange: previousRank == null ? 0 : previousRank - rank }; });
  const start = (page - 1) * pageSize; return { rows: ranked.slice(start, start + pageSize), viewerRow: scope.viewerUserId ? ranked.find(row => row.userId === scope.viewerUserId) ?? null : null, total: ranked.length, page, pageSize, pages: Math.max(1, Math.ceil(ranked.length / pageSize)), sort, direction };
}
