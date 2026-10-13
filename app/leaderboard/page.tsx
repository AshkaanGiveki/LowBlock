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

function LeaderboardLoading() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8">
      <div className="mx-auto max-w-6xl animate-pulse space-y-5">
        <div className="h-48 rounded-[2.25rem] bg-white/[.06]" />
        <div className="h-16 rounded-2xl bg-white/[.06]" />
        <div className="space-y-2 rounded-3xl bg-white/[.04] p-5">
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="h-14 rounded-xl bg-white/[.06]" />
          ))}
        </div>
      </div>
    </main>
  );
}

async function LeaderboardData() {
  const [data, me] = await Promise.all([leaderboard(), currentUserId()]);
  return <LeaderboardView {...data} me={me} />;
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardLoading />}>
      <LeaderboardData />
    </Suspense>
  );
}
