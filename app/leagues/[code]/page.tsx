import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LEAGUES, getLeague } from "@/lib/football/leagues";
import { getMatches, getPredictions } from "@/lib/football/data";
import { currentUserId } from "@/lib/auth/session";
import { PredictionCard } from "@/components/PredictionCard";
import { T } from "@/components/LanguageProvider";

export default async function League({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; const league = getLeague(code); if (!league) return <main className="p-10">لیگ پیدا نشد</main>;
  const matches = await getMatches({ leagueCode: code, limit: 20 }); const predictions = await getPredictions(matches.map((match) => match.providerMatchId), (await currentUserId()) ?? "guest");
  return <main className="mx-auto min-h-screen max-w-7xl px-5 pb-28 pt-24 md:mr-72 md:px-10 md:pb-16 md:pt-28"><div className="panel pitch-lines p-7 md:p-10"><div className="relative"><p className="text-sm text-brand"><T fa="رقابت زنده · زمان ایران" en="Live competition · Iran time"/></p><h1 className="mt-3 text-3xl font-black md:text-5xl"><T fa={league.faName} en={league.enName}/></h1><p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]"><T fa="مسابقه‌های رسمی را ببین، نتیجه را انتخاب کن و امتیاز بگیر." en="Browse official fixtures, choose a score, and earn points."/></p></div></div><div className="mt-6 flex flex-wrap gap-2">{LEAGUES.map((item) => <Link key={item.code} href={`/leagues/${item.code}`} className={`rounded-xl border px-4 py-2 text-sm ${item.code === code ? "border-brand bg-brand-subtle text-brand" : "border-[var(--border)] text-[var(--muted)]"}`}><T fa={item.short} en={item.enName}/></Link>)}</div><section className="mt-7"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black"><T fa="مسابقه‌های این لیگ" en="League fixtures"/></h2><span className="text-xs text-[var(--muted)]">{matches.length} <T fa="مسابقه" en="matches"/></span></div>{matches.length ? <div className="grid gap-5 md:grid-cols-2">{matches.map((match, index) => <PredictionCard key={match.providerMatchId} match={match} initial={predictions.get(match.providerMatchId)} index={index}/>)}</div> : <div className="panel p-10 text-center text-[var(--muted)]"><T fa="برای این لیگ در پنجره فعلی مسابقه‌ای موجود نیست." en="No official fixture is available for this league right now."/></div>}</section><Link href="/app" className="mt-8 inline-flex items-center gap-1 text-sm text-brand"><T fa="بازگشت به داشبورد" en="Back to dashboard"/><ChevronLeft size={16}/></Link></main>;
}
