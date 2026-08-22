import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { currentUserId } from "@/lib/auth/session";
import { LeaderboardView } from "@/components/LeaderboardView";

export const dynamic = "force-dynamic";

type Row = { userId: string; points: number; predictions: number; exact: number; username: string; avatarUrl: string | null };

async function leaderboard(): Promise<{ rows: Row[]; usersCount: number; picksCount: number; roundsCount: number }> {
  const db = await getDb();
  const now = new Date();
  const [users, stats, pickCounts, roundsCount, picksCount] = await Promise.all([
    db.collection<{ username?: string; avatarUrl?: string | null }>("users").find({}, { projection: { username: 1, avatarUrl: 1 } }).toArray(),
    db.collection<Record<string, unknown>>("leaderboardStats").find({ scope: { $in: ["GLOBAL", "global", "all"] } }).toArray(),
    db.collection<{ _id: string; predictions: number }>("predictions").aggregate([{ $match: { userId: { $ne: "guest" } } }, { $group: { _id: "$userId", predictions: { $sum: 1 } } }]).toArray(),
    db.collection("matches").aggregate([{ $match: { kickoffAt: { $lte: now }, matchday: { $gt: 0 } } }, { $group: { _id: { league: "$leagueCode", season: "$seasonStartYear", round: "$matchday" } } }, { $count: "count" }]).toArray(),
    db.collection("predictions").countDocuments({ userId: { $ne: "guest" } }),
  ]);
  const statsById = new Map(stats.map((item) => [String(item.userId ?? ""), { points: Number(item.points ?? item.totalPoints ?? 0), predictions: Number(item.predictions ?? item.predictionCount ?? 0), exact: Number(item.exact ?? item.exactScores ?? 0) }]));
  const picksById = new Map(pickCounts.map((item) => [String(item._id), Number(item.predictions)]));
  const rows = users.map((user) => {
    const userId = String((user as { _id?: ObjectId })._id);
    const stat = statsById.get(userId);
    return { userId, points: stat?.points ?? 0, predictions: stat?.predictions ?? picksById.get(userId) ?? 0, exact: stat?.exact ?? 0, username: user.username ?? "LowBlock Player", avatarUrl: user.avatarUrl ?? null };
  }).sort((a, b) => b.points - a.points || b.predictions - a.predictions || a.username.localeCompare(b.username));
  return { rows, usersCount: users.length, picksCount, roundsCount: Number(roundsCount[0]?.count ?? 0) };
}

export default async function LeaderboardPage() {
  const [data, me] = await Promise.all([leaderboard(), currentUserId()]);
  return <LeaderboardView {...data} me={me} />;
}
