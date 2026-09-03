import { currentUserId } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getMatches, getPredictions } from "@/lib/football/data";
import { MatchesView } from "@/components/MatchesView";
export const dynamic = "force-dynamic";
function appDate(value: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: env.APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ match?: string; tab?: string }> }) { const matches = (await getMatches({ limit: 100 })).filter((match) => appDate(new Date(match.kickoffAt)) === appDate(new Date())); const predictions = await getPredictions(matches.map((match) => match.providerMatchId), (await currentUserId()) ?? "guest"); const query = await searchParams; const focused = query.match ? matches.find((match) => match.providerMatchId === query.match) : undefined; const started = focused && (focused.status === "LIVE" || focused.status === "FINISHED" || focused.status === "SUSPENDED" || new Date(focused.kickoffAt).getTime() <= Date.now()); const initialTab = query.tab === "started" || (!query.tab && Boolean(started)) ? "started" : "open"; return <MatchesView matches={matches} predictions={Object.fromEntries(predictions)} focusMatchId={query.match} initialTab={initialTab} />; }
