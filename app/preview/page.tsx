import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Develop Preview | LowBlock",
  robots: { index: false, follow: false },
};

export default async function PreviewExplorer() {
  // Never expose a public database browser on production.
  if (process.env.NEXT_PUBLIC_LOWBLOCK_PREVIEW !== "true") notFound();
  const db = await getDb();

  const details = await db.collection<any>("matchDetails")
    .find(
      { provider: "sportsapi" },
      { projection: { _id: 0, matchId: 1, stats: 1, incidents: 1, lineups: 1, updatedAt: 1 } },
    )
    .sort({ updatedAt: -1 })
    .limit(120).toArray();

  const detailById = new Map(details.map((detail) => [String(detail.matchId), detail]));
  const richerIds = details
    .filter((detail) => detail.stats?.length || detail.incidents?.length ||
      detail.lineups?.home?.players?.length || detail.lineups?.away?.players?.length)
    .map((detail) => String(detail.matchId))
    .slice(0, 28);

  const [richMatches, recentMatches] = await Promise.all([
    richerIds.length
      ? db.collection<any>("matches").find(
          { provider: "sportsapi", providerMatchId: { $in: richerIds } },
          { projection: { _id: 0, providerMatchId: 1, homeTeam: 1, awayTeam: 1,
            leagueCode: 1, kickoffAt: 1, homeGoals: 1, awayGoals: 1, status: 1 } },
        ).sort({ kickoffAt: -1 }).limit(20).toArray()
      : Promise.resolve([]),
    db.collection<any>("matches").find(
      { provider: "sportsapi", status: { $nin: ["VOID", "CANCELLED"] } },
      { projection: { _id: 0, providerMatchId: 1, homeTeam: 1, awayTeam: 1,
        leagueCode: 1, kickoffAt: 1, homeGoals: 1, awayGoals: 1, status: 1 } },
    ).sort({ kickoffAt: -1 }).limit(30).toArray(),
  ]);
  const unique = new Map<string, any>();
  for (const match of [...richMatches, ...recentMatches]) {
    if (match.providerMatchId && match.homeTeam?.name && match.awayTeam?.name) {
      unique.set(String(match.providerMatchId), match);
    }
    if (unique.size >= 24) break;
  }
  const matches = [...unique.values()];

  return (
    <main className="min-h-screen px-4 pb-28 pt-28 text-white sm:px-8" lang="en" dir="ltr">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <Link href="/matches" className="text-sm font-bold text-brand hover:underline">← Back to matches</Link>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-200">DEVELOP ONLY</span>
        </div>
        <section className="rounded-[2rem] border border-brand/20 bg-[#0d1913] p-6 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[.2em] text-brand">Match Intelligence preview</p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">Explore real saved fixtures</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
            These matches are copied from public football records into an isolated preview database.
            Open any match to explore scores, timeline, stats, lineups, historical form, and head-to-head sections.
            Some sections may be unavailable when the provider did not supply data. No live provider connection runs in preview.
          </p>
        </section>
        {matches.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {matches.map((match) => {
              const id = String(match.providerMatchId);
              const detail = detailById.get(id);
              const date = new Date(match.kickoffAt);
              return (
                <Link
                  key={id}
                  href={`/matches/${encodeURIComponent(id)}`}
                  className="group rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:border-brand/40 hover:bg-brand/[.05]"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-white/45">
                    <span>{String(match.leagueCode || "Football")}</span>
                    <span>{Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable"}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-black">
                    <span className="min-w-0 truncate">{match.homeTeam.name}</span>
                    <span className="text-lg tabular-nums text-brand">
                      {match.homeGoals == null || match.awayGoals == null
                        ? "vs"
                        : `${match.homeGoals} : ${match.awayGoals}`}
                    </span>
                    <span className="min-w-0 truncate text-right">{match.awayTeam.name}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-white/50">
                    <span className="rounded bg-white/10 px-2 py-1">{String(match.status || "SCHEDULED")}</span>
                    {detail?.stats?.length > 0 && <span className="rounded bg-brand/10 px-2 py-1 text-brand">Stats</span>}
                    {detail?.incidents?.length > 0 && <span className="rounded bg-brand/10 px-2 py-1 text-brand">Timeline</span>}
                    {(detail?.lineups?.home?.players?.length > 0 || detail?.lineups?.away?.players?.length > 0) &&
                      <span className="rounded bg-brand/10 px-2 py-1 text-brand">Lineups</span>}
                    <span className="ms-auto text-brand transition group-hover:translate-x-1">Explore →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/50">
          No saved public fixtures are available in this isolated preview yet.
        </div>}
        <p className="mt-8 text-xs leading-6 text-white/40">
          Staging data is a bounded public snapshot and may not reflect current live results. Accounts and prediction histories are separate from production.
        </p>
      </div>
    </main>
  );
}
