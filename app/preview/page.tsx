import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Develop Preview | LowBlock",
  robots: { index: false, follow: false },
};

type PreviewMatch = {
  providerMatchId: string;
  provider: string;
  leagueCode?: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  homeGoals?: number | null;
  awayGoals?: number | null;
  kickoffAt: Date;
  status: string;
  updatedAt?: Date | string | null;
};
const liveStatuses = new Set(["LIVE", "IN_PLAY", "PAUSED", "SUSPENDED", "1H", "2H", "HT", "ET", "PEN"]);
function unique(matches: PreviewMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const id = String(match?.providerMatchId ?? "");
    if (!id || !match?.homeTeam?.name || !match?.awayTeam?.name || seen.has(id)) return false;
    seen.add(id); return true;
  });
}
function MatchGrid({ title, description, matches, enriched, now }: {
  title: string; description: string; matches: PreviewMatch[];
  enriched: Map<string, any>; now: number;
}) {
  return <section className="mt-9" aria-label={title}>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div><h2 className="text-xl font-black text-white">{title} <span className="text-sm font-semibold text-brand">({matches.length})</span></h2>
      <p className="mt-1 text-xs text-white/50">{description}</p></div>
    </div>
    {matches.length ? <div className="grid gap-3 sm:grid-cols-2">
      {matches.map((match) => {
        const id = String(match.providerMatchId);
        const date = new Date(match.kickoffAt);
        const intel = enriched.get(id);
        const fresh = Number.isFinite(new Date(match.updatedAt ?? 0).getTime()) &&
          now - new Date(match.updatedAt ?? 0).getTime() < 15 * 60_000;
        const live = liveStatuses.has(String(match.status).toUpperCase());
        return <Link key={id} href={`/matches/${encodeURIComponent(id)}`}
          className="group rounded-2xl border border-white/10 bg-[#0c1711] p-4 transition hover:border-brand/50 hover:bg-brand/[.04]">
          <div className="flex items-center justify-between gap-2 text-[11px] text-white/45">
            <span>{String(match.leagueCode || "Football")}</span>
            <span>{Number.isFinite(date.getTime()) ? date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "Unknown time"}</span>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-black">
            <span className="min-w-0 truncate">{match.homeTeam.name}</span>
            <span className="text-lg tabular-nums text-brand">{match.homeGoals == null || match.awayGoals == null
              ? "vs" : `${match.homeGoals} : ${match.awayGoals}`}</span>
            <span className="min-w-0 truncate text-right">{match.awayTeam.name}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
            <span className={live && fresh ? "rounded bg-rose-500/20 px-2 py-1 text-rose-300" : "rounded bg-white/10 px-2 py-1 text-white/60"}>
              {live ? fresh ? "LIVE snapshot" : "Delayed live snapshot" : String(match.status || "SCHEDULED")}</span>
            {intel?.providerHistory?.form && <span className="rounded bg-brand/10 px-2 py-1 text-brand">Provider form</span>}
            {intel?.providerHistory?.duel && <span className="rounded bg-brand/10 px-2 py-1 text-brand">Provider H2H</span>}
            <span className="ms-auto text-brand">Explore →</span>
          </div>
        </Link>;
      })}
    </div> : <div className="rounded-xl border border-dashed border-white/15 px-5 py-7 text-xs text-white/45">
      No matches in this group in the isolated public snapshot. This is not an assertion that no real-world matches are being played.
    </div>}
  </section>;
}

export default async function PreviewExplorer() {
  if (process.env.NEXT_PUBLIC_LOWBLOCK_PREVIEW !== "true") notFound();
  const db = await getDb();
  const now = Date.now();
  const projection = { _id: 0, providerMatchId: 1, provider: 1, leagueCode: 1,
    homeTeam: 1, awayTeam: 1, homeGoals: 1, awayGoals: 1,
    kickoffAt: 1, status: 1, updatedAt: 1 };
  // Inspect ALL imported fixtures near today, not a handpicked set with lineups.
  const [active, upcoming, recent, rich] = await Promise.all([
    db.collection<PreviewMatch>("matches").find({
      provider: "sportsapi", status: { $in: [...liveStatuses] },
      kickoffAt: { $gte: new Date(now - 24 * 60 * 60_000), $lte: new Date(now + 5 * 60 * 60_000) },
    }, { projection }).sort({ kickoffAt: 1 }).limit(80).toArray(),
    db.collection<PreviewMatch>("matches").find({
      provider: "sportsapi", kickoffAt: { $gte: new Date(now - 12 * 60 * 60_000), $lte: new Date(now + 5 * 86_400_000) },
    }, { projection }).sort({ kickoffAt: 1 }).limit(120).toArray(),
    db.collection<PreviewMatch>("matches").find({
      provider: "sportsapi", kickoffAt: { $lt: new Date(now), $gte: new Date(now - 7 * 86_400_000) },
    }, { projection }).sort({ kickoffAt: -1 }).limit(60).toArray(),
    db.collection<any>("matchDetails").find({ provider: "sportsapi",
      $or: [{ "stats.0": { $exists: true } }, { "incidents.0": { $exists: true } }, { "lineups.home.players.0": { $exists: true } }] },
      { projection: { _id: 0, matchId: 1 } }).sort({ updatedAt: -1 }).limit(40).toArray(),
  ]);
  const live = unique(active);
  const dayMatches = unique(upcoming.filter((m) => new Date(m.kickoffAt).getTime() <= now + 24 * 60 * 60_000 &&
    !live.some((item) => item.providerMatchId === m.providerMatchId)));
  const nextMatches = unique(upcoming.filter((m) => new Date(m.kickoffAt).getTime() > now + 24 * 60 * 60_000)).slice(0, 48);
  const recentlyFinished = unique(recent.filter((m) => m.status === "FINISHED")).slice(0, 24);
  const richIds = rich.map((item) => String(item.matchId)).filter(Boolean);
  const richMatches = richIds.length ? await db.collection<PreviewMatch>("matches")
    .find({ provider: "sportsapi", providerMatchId: { $in: richIds } }, { projection }).limit(40).toArray() : [];
  const examples = unique(richMatches)
    .filter((m) => !live.concat(dayMatches, nextMatches, recentlyFinished)
      .some((other) => other.providerMatchId === m.providerMatchId))
    .slice(0, 12);
  const ids = unique([...live, ...dayMatches, ...nextMatches, ...recentlyFinished, ...examples])
    .map((m) => "sportsapi:" + m.providerMatchId);
  const histories = ids.length ? await db.collection<any>("footballMatchIntelligence")
    .find({ _id: { $in: ids } }, { projection: { _id: 1, providerHistory: 1 } }).limit(240).toArray() : [];
  const enriched = new Map(histories.map((item) => [String(item._id).replace(/^sportsapi:/, ""), item]));
  return <main className="min-h-screen px-4 pb-28 pt-28 text-white sm:px-8" lang="en" dir="ltr">
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <Link href="/matches?tab=started" className="text-sm font-bold text-brand hover:underline">← All live matches and results</Link>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-200">ISOLATED DEVELOP</span>
      </div>
      <header className="rounded-[2rem] border border-brand/20 bg-[#0d1913] p-6 sm:p-9">
        <p className="text-xs font-black uppercase tracking-[.2em] text-brand">Match Intelligence</p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">Explore current football fixtures</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
          These fixtures are read-only public match snapshots mirrored into an isolated develop database,
          not a handpicked lineup-only demo. Click any available fixture to see its Match Intelligence sections.
          Live status can be delayed; no external provider connection runs from this preview.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold">
          <Link href="/matches?tab=started" className="rounded-xl border border-brand/40 px-4 py-2 text-brand">Full match list</Link>
          <Link href="/matches?tab=open" className="rounded-xl border border-white/15 px-4 py-2 text-white/70">Upcoming fixtures</Link>
        </div>
      </header>
      <MatchGrid title="Live snapshots" description="Only matches reported in progress in the public data mirror" matches={live} enriched={enriched} now={now} />
      <MatchGrid title="Today and next 24 hours" description="Every imported fixture in this window, not just those with lineups" matches={dayMatches} enriched={enriched} now={now} />
      <MatchGrid title="Upcoming fixtures" description="The next five days of imported fixtures" matches={nextMatches} enriched={enriched} now={now} />
      <MatchGrid title="Recent results" description="Recent completed matches available in the local snapshot" matches={recentlyFinished} enriched={enriched} now={now} />
      {examples.length > 0 && <MatchGrid title="Other matches with detailed data" description="Older examples with confirmed saved match details" matches={examples} enriched={enriched} now={now} />}
      <p className="mt-9 text-xs leading-6 text-white/40">
        Provider form and H2H appear only after verified enrichment is cached. A missing badge means unavailable,
        not zero. Accounts and prediction histories are not copied from production.
      </p>
    </div>
  </main>;
}
