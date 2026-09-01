import { getDb } from "@/lib/db/mongo";
import { currentUserId } from "@/lib/auth/session";
import { LeaderboardView } from "@/components/LeaderboardView";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";

export const metadata = { title: "Football Prediction Leaderboard", description: "See the LowBlock football prediction leaderboard and compare points, predictions, and exact scores.", alternates: { canonical: "/leaderboard" } };

export const dynamic = "force-dynamic";

type Row = { userId: string; points: number; predictions: number; exact: number; username: string; avatarUrl: string | null };

async function leaderboard(): Promise<{ rows: Row[]; usersCount: number; picksCount: number; roundsCount: number }> {
  const db = await getDb();
  const year = Number((await db.collection("matches").findOne({}, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } }))?.seasonStartYear ?? new Date().getUTCFullYear());
  const [rows, usersCount, picksCount, roundsCount] = await Promise.all([getCanonicalLeaderboard(db, { seasonStartYear: year }, 100), db.collection("users").countDocuments(), db.collection("predictions").countDocuments({ userId: { $ne: "guest" } }), db.collection("rounds").countDocuments({ status: "FINAL" })]);
  return { rows, usersCount, picksCount, roundsCount };
}

export default async function LeaderboardPage() {
  const [data, me] = await Promise.all([leaderboard(), currentUserId()]);
  return <LeaderboardView {...data} me={me} />;
}
