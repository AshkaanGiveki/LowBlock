import { Suspense } from "react";
import { currentUserId } from "@/lib/auth/session";
import { getMatchesPage, getPredictions } from "@/lib/football/data";
import { getTournamentPreferences } from "@/lib/football/preferences";
import { MatchesView } from "@/components/MatchesView";

export const dynamic = "force-dynamic";

type MatchesQuery = { match?: string; tab?: string };

function MatchesLoading() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5">
        <div className="h-24 rounded-[2rem] bg-white/[.06]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-64 rounded-[1.75rem] bg-white/[.06]" />
          ))}
        </div>
      </div>
    </main>
  );
}

async function MatchesData({ query }: { query: MatchesQuery }) {
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
  );
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<MatchesQuery>;
}) {
  const query = await searchParams;
  return (
    <Suspense fallback={<MatchesLoading />}>
      <MatchesData query={query} />
    </Suspense>
  );
}
