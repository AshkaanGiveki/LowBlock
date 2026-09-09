import { Suspense } from "react";
import { getDb } from "@/lib/db/mongo";
import { currentUserId } from "@/lib/auth/session";
import { LeaderboardView } from "@/components/LeaderboardView";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { getLatestSeasonStartYear } from "@/lib/football/data";

export const metadata = {
  title: "Football Prediction Leaderboard",
  description:
    "See the LowBlock football prediction leaderboard and compare points, predictions, and exact scores.",
  alternates: { canonical: "/leaderboard" },
};

export const dynamic = "force-dynamic";

type Row = {
  userId: string;
  points: number;
  predictions: number;
  exact: number;
  username: string;
  avatarUrl: string | null;
};

async function leaderboard(): Promise<{
  rows: Row[];
  usersCount: number;
  picksCount: number;
  roundsCount: number;
}> {
  const db = await getDb();
  const year = await getLatestSeasonStartYear();
  const [rows, usersCount, picksCount, roundsCount] = await Promise.all([
    getCanonicalLeaderboard(db, { seasonStartYear: year }, 20),
    db.collection("users").countDocuments(),
    db.collection("predictions").countDocuments({ userId: { $ne: "guest" } }),
    db.collection("rounds").countDocuments({ status: "FINAL" }),
  ]);
  return { rows, usersCount, picksCount, roundsCount };
}

export default async function LeaderboardPage() {
  const [data, me] = await Promise.all([leaderboard(), currentUserId()]);
  return (
    <Suspense
      fallback={
        <div className="min-h-screen animate-pulse p-8">
          <div className="mx-auto h-96 max-w-6xl rounded-3xl bg-white/[.06]" />
        </div>
      }
    >
      <LeaderboardView {...data} me={me} />
    </Suspense>
  );
}
