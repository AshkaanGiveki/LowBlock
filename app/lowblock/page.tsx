import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { LeaderboardExplorer } from "@/components/LeaderboardExplorer";
import { T } from "@/components/LanguageProvider";
import { LEAGUES } from "@/lib/football/leagues";
import { BarChart3, Sparkles, Trophy, Users } from "lucide-react";

export const metadata = { title: "Global Football Prediction Leaderboard", description: "Compare football prediction points with LowBlock players around the world and across major leagues.", alternates: { canonical: "/lowblock" } };

export const dynamic = "force-dynamic";

export default async function LowBlockPage({ searchParams }: { searchParams: Promise<{ scope?: string; league?: string; week?: string }> }) {
  const query = await searchParams;
  const weekly = query.scope === "weekly";
  const weekOffset = weekly && query.week === "previous" ? 1 : 0;
  const lifetime = query.scope === "lifetime";
  const league = LEAGUES.find((item) => item.code === query.league);
  const db = await getDb();
  const year = Number((await db.collection("matches").findOne({}, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } }))?.seasonStartYear ?? new Date().getUTCFullYear());
  const rows = await getCanonicalLeaderboard(db, { seasonStartYear: lifetime || weekly ? null : year, leagueCode: league?.code ?? null, weekly, weeklyOffset: weekOffset }, 100);
  const [usersCount, picksCount, roundsCount, me] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("predictions").countDocuments({ userId: { $ne: "guest" } }),
    db.collection("rounds").countDocuments({ status: "FINAL" }),
    currentUserId(),
  ]);

  return <main className="desktop-lowblock-page min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-6xl">
    <section className="lowblock-command-hero relative overflow-hidden rounded-[2rem] border border-white/[.08] bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.24),transparent_38%),linear-gradient(145deg,#14251c,#0a0f0c)] p-7 md:p-10">
      <div className="relative z-10 max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand"><T fa="رقابت جهانی" en="GLOBAL COMPETITION" /><Sparkles size={13} /></div><h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl"><T fa="رقابت کلی" en="The universal competition" /></h1><p className="mt-3 text-sm text-white/60"><T fa={lifetime ? "از آغاز تا امروز" : `فصل ${year}/${String(year + 1).slice(-2)}`} en={lifetime ? "From the beginning" : `Season ${year}/${String(year + 1).slice(-2)}`} /></p></div>
      <div className="lowblock-command-orbit" aria-hidden="true"><Trophy size={42} /></div>
      <div className="lowblock-metric-grid mt-8 grid grid-cols-3 gap-3"><Metric icon={<Users size={17} />} value={usersCount} fa="کاربر" en="Users" /><Metric icon={<BarChart3 size={17} />} value={picksCount} fa="پیش‌بینی" en="Predictions" /><Metric icon={<Trophy size={17} />} value={roundsCount} fa="راند نهایی" en="Final rounds" /></div>
    </section>
    <LeaderboardExplorer initialRows={rows} seasonStartYear={year} leagueCode={league?.code} lifetime={lifetime} weekly={weekly} weekOffset={weekOffset} me={me} />
  </div></main>;
}

function Metric({ icon, value, fa, en }: { icon: React.ReactNode; value: number; fa: string; en: string }) { return <div className="lowblock-metric group relative overflow-hidden rounded-2xl border border-white/[.1] bg-black/20 p-4"><span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-brand">{icon}</span><b className="relative mt-4 block text-2xl tracking-tight">{value}</b><small className="relative mt-1 block text-[10px] font-bold text-white/45"><T fa={fa} en={en} /></small><span className="lowblock-metric-line" /></div>; }
