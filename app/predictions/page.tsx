import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { calculatePredictionScore } from "@/lib/scoring/calculatePredictionScore";
import { PredictionHistory } from "@/components/PredictionHistory";

export const dynamic = "force-dynamic";

function PredictionsLoading() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8">
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-28 rounded-[2rem] bg-white/[.06]" />
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-white/[.06]" />
        ))}
      </div>
    </main>
  );
}

async function PredictionsData() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const db = await getDb();
  const predictions = await db
    .collection<{
      matchId: string;
      homeGoals: number;
      awayGoals: number;
      updatedAt: Date;
    }>("predictions")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const matches = predictions.length
    ? await db
        .collection<{
          providerMatchId: string;
          kickoffAt: Date;
          homeGoals: number | null;
          awayGoals: number | null;
          homeTeam: { id: number; name: string; logoUrl: string | null };
          awayTeam: { id: number; name: string; logoUrl: string | null };
        }>("matches")
        .find({
          provider: { $in: ["football-api", "sportsapi"] },
          providerMatchId: { $in: predictions.map((item) => item.matchId) },
        })
        .toArray()
    : [];
  const byId = new Map(matches.map((match) => [match.providerMatchId, match]));
  const rows = predictions.flatMap((prediction) => {
    const match = byId.get(prediction.matchId);
    if (!match) return [];
    const score = calculatePredictionScore(
      prediction.homeGoals,
      prediction.awayGoals,
      match.homeGoals,
      match.awayGoals,
    );
    return [
      {
        matchId: prediction.matchId,
        kickoffAt: match.kickoffAt.toISOString(),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        predictedHome: prediction.homeGoals,
        predictedAway: prediction.awayGoals,
        actualHome: match.homeGoals,
        actualAway: match.awayGoals,
        points: score.points,
        category: score.category,
      },
    ];
  });
  return <PredictionHistory rows={rows} />;
}

export default function PredictionsPage() {
  return (
    <Suspense fallback={<PredictionsLoading />}>
      <PredictionsData />
    </Suspense>
  );
}
