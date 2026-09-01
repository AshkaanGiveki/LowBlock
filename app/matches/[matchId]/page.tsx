import { redirect } from "next/navigation";
import { getMatch } from "@/lib/football/data";
import { isPredictionLocked } from "@/lib/domain/predictionLock";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const match = matchId && matchId.length <= 100 ? await getMatch(decodeURIComponent(matchId)) : null;
  if (!match) redirect("/matches");
  if (isPredictionLocked(match)) redirect(`/leagues/${encodeURIComponent(match.leagueCode)}/round/${match.matchday}?match=${encodeURIComponent(match.providerMatchId)}`);
  redirect(`/matches?match=${encodeURIComponent(match.providerMatchId)}`);
}
