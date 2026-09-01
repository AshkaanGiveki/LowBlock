import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getMatch, getPredictions } from "@/lib/football/data";
import { getLeague } from "@/lib/football/leagues";
import { teamName } from "@/lib/football/team-names";
import { PredictionCard } from "@/components/PredictionCard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ matchId: string }> };

async function matchFromParams(params: Props["params"]) {
  const { matchId } = await params;
  if (!matchId || matchId.length > 100) return null;
  return getMatch(decodeURIComponent(matchId));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const match = await matchFromParams(params);
  if (!match) return { title: "Match not found", robots: { index: false, follow: false } };
  const league = getLeague(match.leagueCode);
  const title = `${match.homeTeam.name} vs ${match.awayTeam.name} Predictions`;
  return {
    title,
    description: `Predict ${match.homeTeam.name} vs ${match.awayTeam.name}${league ? ` in the ${league.enName}` : ""} on LowBlock and compete on the football leaderboard.`,
    alternates: { canonical: `/matches/${encodeURIComponent(match.providerMatchId)}` },
    openGraph: { title, description: `Make your prediction for ${title} on LowBlock.`, type: "website" },
  };
}

export default async function MatchPage({ params }: Props) {
  const match = await matchFromParams(params);
  if (!match) notFound();
  const userId = await currentUserId();
  const predictions = await getPredictions([match.providerMatchId], userId ?? "guest");
  const league = getLeague(match.leagueCode);
  const home = teamName("en", match.homeTeam.id, match.homeTeam.name);
  const away = teamName("en", match.awayTeam.id, match.awayTeam.name);

  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-black tracking-[.18em] text-brand">{league?.enName ?? "FOOTBALL MATCH"}</p>
        <h1 className="mt-2 text-3xl font-black md:text-5xl">{home} vs {away}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Predict the final score, save your pick, and compete across LowBlock leaderboards.
        </p>
        <div className="mt-8">
          <PredictionCard
            match={match}
            initial={predictions.get(match.providerMatchId)}
            openOnMount
            index={0}
          />
        </div>
      </div>
    </main>
  );
}
