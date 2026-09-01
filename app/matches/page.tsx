import { currentUserId } from "@/lib/auth/session";
import { getMatches, getPredictions } from "@/lib/football/data";
import { MatchesView } from "@/components/MatchesView";
export const dynamic = "force-dynamic";
export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ match?: string }> }) { const matches = await getMatches({ limit: 100 }); const predictions = await getPredictions(matches.map((match) => match.providerMatchId), (await currentUserId()) ?? "guest"); const query = await searchParams; return <MatchesView matches={matches} predictions={Object.fromEntries(predictions)} focusMatchId={query.match} />; }
