import Link from "next/link";
import { ArrowLeft, BarChart3, CircleDot, LockKeyhole, Trophy } from "lucide-react";
import { LEAGUES } from "@/lib/football/leagues";
import { getMatches } from "@/lib/football/data";
import { formatIranDate, formatIranTime } from "@/lib/football/time";
import { MotionIn } from "@/components/MotionIn";
import { TeamCrest } from "@/components/TeamCrest";

export default async function Home() {
  const [match] = await getMatches({ limit: 1 });
  return <main className="min-h-screen pb-24 pt-24 md:mr-72 md:pb-8 md:pt-20">
    <section className="pitch-lines mx-auto max-w-7xl px-5 pb-20 pt-12 md:px-10 md:pt-24"><div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_.85fr]">
      <MotionIn><div><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-subtle px-3 py-1.5 text-xs font-semibold text-brand"><CircleDot size={14}/> فصل جدید رقابت از همین‌جا شروع می‌شود</div>
        <h1 className="max-w-3xl text-4xl font-black leading-[1.25] tracking-tight md:text-7xl">هر مسابقه،<br/><span className="text-brand">یک تصمیم</span> تازه.</h1>
        <p className="mt-6 max-w-xl text-lg leading-9 text-[var(--muted)]">بازی‌های واقعی پنج لیگ بزرگ اروپا را پیش‌بینی کن، امتیاز بگیر و جایگاهت را بین بهترین‌ها بساز.</p>
        <div className="mt-9 flex flex-wrap gap-3"><Link href="/signup" className="focus-ring inline-flex items-center gap-3 rounded-xl bg-brand px-5 py-3.5 font-bold text-ink transition hover:bg-brand-hover">شروع رایگان <ArrowLeft size={18}/></Link><Link href="/login" className="focus-ring rounded-xl border border-[var(--border-strong)] px-5 py-3.5 font-semibold text-white transition hover:bg-white/5">ورود به حساب</Link></div>
        <div className="mt-12 flex gap-10 text-sm text-[var(--muted)]"><span><b className="block text-2xl text-white">۱۰</b>امتیاز پیش‌بینی دقیق</span><span><b className="block text-2xl text-white">۵</b>لیگ معتبر اروپا</span><span><b className="block text-2xl text-white">۰٪</b>ریسک و هزینه</span></div>
      </div></MotionIn>
      <div className="panel relative p-5 md:p-7"><div className="mb-6 flex items-center justify-between"><div><span className="text-xs text-[var(--muted)]">آخرین مسابقه واقعی</span><h2 className="mt-1 text-xl font-bold">پیش‌بینی فوتبال</h2></div><span className="rounded-full bg-brand-subtle px-3 py-1 text-xs text-brand">منبع رسمی</span></div>
        {match ? <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-6"><div className="mb-4 text-center text-xs text-[var(--muted)]">{formatIranDate(match.kickoffAt)} · {formatIranTime(match.kickoffAt)}</div><div className="flex items-center justify-between gap-3 text-center"><div className="flex w-24 flex-col items-center gap-2"><TeamCrest name={match.homeTeam.name} logo={match.homeTeam.logoUrl}/><span className="text-xs font-semibold">{match.homeTeam.name}</span></div><span className="text-sm text-[var(--muted)]">در برابر</span><div className="flex w-24 flex-col items-center gap-2"><TeamCrest name={match.awayTeam.name} logo={match.awayTeam.logoUrl}/><span className="text-xs font-semibold">{match.awayTeam.name}</span></div></div></div> : <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-10 text-center text-sm text-[var(--muted)]">در حال حاضر مسابقه‌ای از منبع رسمی در پنجره پیش‌رو ثبت نشده است.</div>}
        <p className="mt-5 text-center text-xs text-[var(--muted)]">هیچ مسابقه‌ای در این صفحه ساختگی نیست.</p>
      </div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 pb-24 md:px-10"><div className="mb-6"><span className="text-sm text-brand">مسیر رقابت</span><h2 className="mt-2 text-2xl font-bold md:text-3xl">پنج لیگ، یک جدول</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{LEAGUES.map((league, i) => <Link href={`/leagues/${league.code}`} key={league.code} className="panel group p-5 transition duration-300 hover:-translate-y-1 hover:border-brand/40"><div className="mb-8 grid h-10 w-10 place-items-center rounded-xl bg-brand-subtle text-sm font-black text-brand">{String(i + 1).padStart(2, "0")}</div><h3 className="font-bold">{league.faName}</h3><p className="mt-2 text-xs text-[var(--muted)]">داده‌ها از API رسمی فوتبال</p></Link>)}</div></section>
    <section className="border-t border-[var(--border)]"><div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 text-sm text-[var(--muted)] md:grid-cols-3 md:px-10"><div className="flex gap-3"><LockKeyhole className="shrink-0 text-brand" size={20}/><span><b className="block text-white">امن و شفاف</b>فقط امتیاز؛ بدون شرط‌بندی یا پول</span></div><div className="flex gap-3"><Trophy className="shrink-0 text-brand" size={20}/><span><b className="block text-white">رقابت واقعی</b>جدول امتیازات بر اساس نتایج رسمی</span></div><div className="flex gap-3"><BarChart3 className="shrink-0 text-brand" size={20}/><span><b className="block text-white">قابل اندازه‌گیری</b>تاریخچه و آمار پیش‌بینی‌هایت</span></div></div></section>
  </main>;
}
