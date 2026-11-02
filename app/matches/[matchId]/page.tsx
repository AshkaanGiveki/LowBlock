import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getMatch, getMatches, getPredictions } from "@/lib/football/data";
import { getLeague } from "@/lib/football/leagues";
import { teamName } from "@/lib/football/team-names";
import { MatchPageExperience } from "@/components/MatchPageExperience";

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
    description: `Predict ${match.homeTeam.name} vs ${match.awayTeam.name}${league ? ` in the ${league.enName}` : ""} on LowBlock.`,
    alternates: { canonical: `/matches/${encodeURIComponent(match.providerMatchId)}` },
    openGraph: { title, description: `Make your football prediction for ${title} on LowBlock.`, type: "website" },
  };
}

export default async function MatchPage({ params }: Props) {
  const match = await matchFromParams(params);
  if (!match) notFound();
  const userId = await currentUserId();
  const predictions = await getPredictions([match.providerMatchId], userId ?? "guest");
  const league = getLeague(match.leagueCode);
  const relatedMatches = (await getMatches({ leagueCode: match.leagueCode, limit: 8 }))
    .filter((item) => item.providerMatchId !== match.providerMatchId)
    .slice(0, 3);
  const home = teamName("en", match.homeTeam.id, match.homeTeam.name, undefined, match.homeTeam.faName);
  const away = teamName("en", match.awayTeam.id, match.awayTeam.name, undefined, match.awayTeam.faName);
  const isLive = ["LIVE", "1H", "2H", "HT", "ET", "PEN"].includes(String(match.status).toUpperCase());
  const isFinished = ["FINISHED", "FT"].includes(String(match.status).toUpperCase());
  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${home} vs ${away}`,
    sport: "Football",
    startDate: new Date(match.kickoffAt).toISOString(),
    eventStatus: isFinished ? "https://schema.org/EventCompleted" : "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: league?.enName ?? "Football" },
    competitor: [{ "@type": "SportsTeam", name: home }, { "@type": "SportsTeam", name: away }],
    url: `https://lowblock.ir/matches/${encodeURIComponent(match.providerMatchId)}`,
  };

  return <>
    <MatchPageExperience match={match} initial={predictions.get(match.providerMatchId)} leagueName={league?.enName ?? "Football match"} leagueFaName={league?.faName ?? "مسابقه فوتبال"} relatedMatches={relatedMatches} isLive={isLive} isFinished={isFinished} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }} />
  </>;
}
