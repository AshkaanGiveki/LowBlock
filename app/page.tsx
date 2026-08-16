import Link from "next/link";
import { ArrowLeft, BarChart3, LockKeyhole, Trophy } from "lucide-react";
import { getMatches } from "@/lib/football/data";
import { Brand } from "@/components/Brand";
import { HomeFixtureSlider } from "@/components/HomeFixtureSlider";
import { LogoLoop } from "@/components/LogoLoop";
import { T } from "@/components/LanguageProvider";

export default async function Home() {
  const matches = await getMatches({ limit: 5 });
  return <main className="min-h-screen pb-24 pt-24 md:mr-72 md:pb-8 md:pt-24">
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-16">
      <div className="relative overflow-hidden rounded-[38px] border border-white/[.08] bg-[radial-gradient(circle_at_12%_25%,rgba(18,160,105,.32),transparent_28%),linear-gradient(135deg,#111914,#050706)] p-7 md:p-12">
        <div className="pointer-events-none absolute -left-28 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full border border-brand/15" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div><Brand variant="stacked" className="mb-8 w-fit items-start" /><h1 className="max-w-3xl text-4xl font-black leading-[1.2] md:text-7xl"><T fa="تو فقط نتیجه را حدس نمی‌زنی؛" en="You don't just guess the score;" /><br /><span className="text-brand"><T fa="آینده بازی را می‌خوانی." en="you read the future of the match." /></span></h1><p className="mt-6 max-w-xl text-base leading-8 text-[var(--muted)]"><T fa="پلتفرم پیش‌بینی پنج لیگ بزرگ اروپا با مسابقه‌های واقعی، امتیازدهی شفاف و رقابتی که هر هفته جدی‌تر می‌شود." en="Predict Europe's top five leagues with real fixtures, transparent scoring, and a competition that gets sharper every week." /></p><div className="mt-8 flex flex-wrap gap-3"><Link href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-black text-white"><T fa="ساخت حساب رایگان" en="Create free account" /><ArrowLeft size={17} /></Link><Link href="/app" className="rounded-2xl border border-white/10 bg-white/[.04] px-6 py-3.5 text-sm font-black"><T fa="دیدن مسابقه‌ها" en="Browse fixtures" /></Link></div></div>
          <HomeFixtureSlider matches={matches} />
        </div>
      </div>
    </section>
    <LogoLoop />
    <section className="border-t border-white/[.06]"><div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 text-sm text-[var(--muted)] md:grid-cols-3 md:px-10"><Feature icon={<LockKeyhole />} title={<T fa="امن و شفاف" en="Safe and transparent" />} /><Feature icon={<Trophy />} title={<T fa="رقابت واقعی" en="Real competition" />} /><Feature icon={<BarChart3 />} title={<T fa="پیشرفت قابل اندازه‌گیری" en="Measurable progress" />} /></div></section>
  </main>;
}

function Feature({ icon, title }: { icon: React.ReactNode; title: React.ReactNode }) { return <div className="flex items-center gap-3"><span className="text-brand">{icon}</span><b className="text-white">{title}</b></div>; }
