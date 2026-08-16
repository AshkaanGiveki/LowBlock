import Link from "next/link";
import { CalendarDays, ChartNoAxesCombined, Trophy } from "lucide-react";
import { LEAGUES } from "@/lib/football/leagues";
import { getMatches, getPredictions } from "@/lib/football/data";
import { PredictionCard } from "@/components/PredictionCard";
import { currentUserId } from "@/lib/auth/session";
import { DashboardHero } from "@/components/DashboardHero";
import { T } from "@/components/LanguageProvider";

export default async function Dashboard() {
  const matches = await getMatches({ limit: 12 });
  const predictions = await getPredictions(matches.map((match) => match.providerMatchId), (await currentUserId()) ?? "guest");
  return <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pb-16 md:pt-32"><div className="mx-auto max-w-7xl">
    <DashboardHero/>
    <div className="mb-9 grid gap-3 sm:grid-cols-3"><Stat icon={<Trophy/>} label={<T fa="امتیاز کل" en="Total points"/>} value="—"/><Stat icon={<ChartNoAxesCombined/>} label={<T fa="رتبه جهانی" en="Global rank"/>} value="—"/><Stat icon={<CalendarDays/>} label={<T fa="مسابقه‌های پیش‌رو" en="Upcoming matches"/>} value={String(matches.length)}/></div>
    <section><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold tracking-wide text-brand"><T fa="فید مسابقه‌ها" en="MATCH FEED"/></p><h2 className="mt-1 text-2xl font-black"><T fa="پیش‌بینی‌های امروز" en="Today's predictions"/></h2></div><span className="text-xs text-[var(--muted)]"><T fa="زمان ایران · منبع رسمی" en="Iran time · Official source"/></span></div>{matches.length ? <div className="grid gap-5 lg:grid-cols-2">{matches.map((match, index) => <PredictionCard key={match.providerMatchId} match={match} initial={predictions.get(match.providerMatchId)} index={index}/>)}</div> : <div className="rounded-[26px] border border-dashed border-white/10 p-12 text-center text-sm text-[var(--muted)]"><T fa="در حال حاضر مسابقه واقعی در پنجره پیش‌رو ثبت نشده است." en="No official match is currently available in the upcoming window."/></div>}</section>
    <section className="mt-12"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black"><T fa="پنج لیگ بزرگ" en="Europe's top five leagues"/></h2><Link href="/leagues/GB1" className="text-xs text-brand"><T fa="مشاهده همه ←" en="View all ←"/></Link></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{LEAGUES.map((league, i) => <Link key={league.code} href={`/leagues/${league.code}`} className="group rounded-2xl border border-white/[.08] bg-[#111116] p-4 transition hover:-translate-y-1 hover:border-brand/50"><span className="text-[11px] font-black text-brand">{String(i + 1).padStart(2, "0")}</span><h3 className="mt-6 font-bold"><T fa={league.faName} en={league.enName}/></h3><span className="mt-3 block text-xs text-[var(--muted)] group-hover:text-white"><T fa="ورود به لیگ ←" en="Open league ←"/></span></Link>)}</div></section>
  </div></main>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: React.ReactNode; value: string }) { return <div className="flex items-center gap-4 rounded-2xl border border-white/[.08] bg-[#111116] p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/10 text-brand">{icon}</span><span><small className="block text-xs text-[var(--muted)]">{label}</small><b className="mt-1 block text-2xl">{value}</b></span></div>; }
