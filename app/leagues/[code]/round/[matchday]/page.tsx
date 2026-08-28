import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/mongo";
import { getLeague } from "@/lib/football/leagues";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { isPredictionLocked } from "@/lib/domain/predictionLock";
import { T } from "@/components/LanguageProvider";
import { BackButton } from "@/components/BackButton";
import { LeagueRoundLeaderboard } from "@/components/LeagueRoundLeaderboard";
import { RoundMatchGrid } from "@/components/RoundMatchGrid";
import { LeagueLogo } from "@/components/LeagueLogo";

export const dynamic = "force-dynamic";

export default async function RoundPage({
  params,
}: {
  params: Promise<{ code: string; matchday: string }>;
}) {
  const { code, matchday } = await params;
  const league = getLeague(code);
  if (!league) notFound();
  const day = Number(matchday);
  const db = await getDb();
  const matches = await db
    .collection<any>("matches")
    .find({ leagueCode: code, matchday: day })
    .sort({ kickoffAt: 1 })
    .toArray();
  if (!matches.length) notFound();
  const year = Number(matches[0].seasonStartYear);
  const canonical = await getCanonicalLeaderboard(
    db,
    { leagueCode: code, seasonStartYear: year, matchday: day },
    100,
  );
  const ids = canonical.map((row) => row.userId);
  const predictions = await db
    .collection<any>("predictions")
    .find({
      userId: { $in: ids },
      matchId: { $in: matches.map((match) => match.providerMatchId) },
    })
    .toArray();
  const scores = await db
    .collection<any>("predictionScores")
    .find({
      userId: { $in: ids },
      matchId: { $in: matches.map((match) => match.providerMatchId) },
    })
    .toArray();
  const scoreMap = new Map(
    scores.map((score) => [`${score.userId}:${score.matchId}`, score]),
  );
  const users = new Map(canonical.map((row) => [row.userId, row]));
  const grouped = new Map<string, any>();
  for (const prediction of predictions) {
    const match = matches.find(
      (item) => item.providerMatchId === prediction.matchId,
    );
    if (!match) continue;
    const locked = isPredictionLocked(match);
    const score = scoreMap.get(`${prediction.userId}:${prediction.matchId}`);
    const row = grouped.get(prediction.userId) ?? {
      userId: prediction.userId,
      username: users.get(prediction.userId)?.username ?? "LowBlock Player",
      avatarUrl: users.get(prediction.userId)?.avatarUrl ?? null,
      points: 0,
      predictions: [],
    };
    row.points += locked ? Number(score?.points ?? 0) : 0;
    row.predictions.push({
      matchId: prediction.matchId,
      kickoffAt: new Date(match.kickoffAt).toISOString(),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      predictedHome: locked ? prediction.homeGoals : null,
      predictedAway: locked ? prediction.awayGoals : null,
      actualHome: locked ? match.homeGoals : null,
      actualAway: locked ? match.awayGoals : null,
      points: locked ? Number(score?.points ?? 0) : null,
      revealed: locked,
    });
    grouped.set(prediction.userId, row);
  }
  const players = canonical.map(
    (row) =>
      grouped.get(row.userId) ?? {
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        points: row.points,
        predictions: [],
      },
  );
  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-3xl">
        <BackButton />
        <div className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-[radial-gradient(circle_at_85%_0%,rgba(32,184,121,.2),transparent_38%),linear-gradient(145deg,#14241b,#0b100d)] p-6 md:p-9">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-[#0b120e] p-2 shadow-inner">
              <LeagueLogo src={league.logo} className="h-full w-full" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-[.2em] text-brand">
                <T fa={league.faName} en={league.enName} />
              </p>
              <h1 className="mt-1 truncate text-3xl font-black">
                <T fa={`دور ${day}`} en={`Round ${day}`} />
              </h1>
              <p className="mt-2 text-sm text-white/60">
                <T
                  fa="امتیازها از جدول مرکزی محاسبه می‌شوند"
                  en="Scores come from the canonical leaderboard"
                />
              </p>
            </div>
          </div>
        </div>
        <RoundMatchGrid
          fixtures={matches.map((match) => ({
            providerMatchId: match.providerMatchId,
            kickoffAt: new Date(match.kickoffAt).toISOString(),
            status: match.status,
            homeGoals: match.homeGoals,
            awayGoals: match.awayGoals,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
          }))}
        />
        <LeagueRoundLeaderboard players={players} />
      </div>
    </main>
  );
}
