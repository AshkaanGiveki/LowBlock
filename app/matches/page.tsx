import { currentUserId } from "@/lib/auth/session";
import { getMatches, getPredictions } from "@/lib/football/data";
import { MatchesView } from "@/components/MatchesView";
export const dynamic = "force-dynamic";
export default async function MatchesPage() { const matches = await getMatches({ limit: 100 }); const predictions = await getPredictions(matches.map((match) => match.providerMatchId), (await currentUserId()) ?? "guest"); return <MatchesView matches={matches} predictions={Object.fromEntries(predictions)} />; }
