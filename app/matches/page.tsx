import { Suspense } from "react";
import { currentUserId } from "@/lib/auth/session";
import { getMatchesPage, getPredictions } from "@/lib/football/data";
import { getTournamentPreferences } from "@/lib/football/preferences";
import { MatchesView } from "@/components/MatchesView";
export const dynamic = "force-dynamic";
export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string; tab?: string }>;
}) {
  const query = await searchParams;
  const [page, userId] = await Promise.all([
    getMatchesPage(30),
    currentUserId(),
  ]);
  const [predictions, preferences] = await Promise.all([
    getPredictions(
      page.matches.map((match) => match.providerMatchId),
      userId ?? "guest",
    ),
    userId
      ? getTournamentPreferences(userId)
      : Promise.resolve({ favoriteTournamentIds: [], showAllMatches: true }),
  ]);
  const focused = query.match
    ? page.matches.find((match) => match.providerMatchId === query.match)
    : undefined;
  const started =
    focused &&
    (focused.status === "LIVE" ||
      focused.status === "FINISHED" ||
      focused.status === "SUSPENDED" ||
      new Date(focused.kickoffAt).getTime() <= Date.now());
  const initialTab =
    query.tab === "started" || (!query.tab && Boolean(started))
      ? "started"
      : "open";
  return (
    <Suspense
      fallback={
        <div className="min-h-screen animate-pulse p-8">
          <div className="mx-auto h-96 max-w-7xl rounded-3xl bg-white/[.06]" />
        </div>
      }
    >
      <MatchesView
        matches={page.matches}
        predictions={Object.fromEntries(predictions)}
        nextCursor={page.nextCursor}
        hasMore={page.hasMore}
        initialSelectedLeagues={preferences.favoriteTournamentIds}
        initialShowAllMatches={preferences.showAllMatches}
        focusMatchId={query.match}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
