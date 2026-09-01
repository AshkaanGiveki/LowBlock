import { getDb } from "@/lib/db/mongo";
import { currentUserId } from "@/lib/auth/session";
import { T } from "@/components/LanguageProvider";
import { DetailedLeaderboard } from "@/components/DetailedLeaderboard";
import { ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Complete Global Football Prediction Standings", description: "Detailed LowBlock global standings with predictions, exact scores, correct results, points, averages, rank movement, and awards." };

export default async function GlobalStandingsPage() {
  const db = await getDb(); await currentUserId();
  const year = Number((await db.collection<any>("matches").findOne({}, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } }))?.seasonStartYear ?? new Date().getUTCFullYear());
  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl"><Link href="/lowblock" className="inline-flex items-center gap-2 text-xs font-black text-brand"><ArrowLeft size={15}/><T fa="بازگشت به جدول جهانی" en="Back to global leaderboard"/></Link><section className="mt-4 rounded-[2rem] border border-brand/20 bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.26),transparent_38%),linear-gradient(145deg,#14251c,#0a0f0c)] p-6 shadow-[0_28px_90px_rgba(0,0,0,.24)] sm:p-10"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand"><BarChart3 size={24}/></span><div><p className="text-[10px] font-black tracking-[.22em] text-brand">COMPLETE STANDINGS</p><h1 className="mt-2 text-3xl font-black text-white sm:text-5xl"><T fa="جدول کامل جهانی" en="Complete global standings"/></h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/55"><T fa={`فصل ${year}/${String(year + 1).slice(-2)} · همه جزئیات عملکرد بازیکنان`} en={`Season ${year}/${String(year + 1).slice(-2)} · every player-performance detail`}/></p></div></div></section><DetailedLeaderboard seasonStartYear={year}/></div></main>;
}
