"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Swords, UsersRound } from "lucide-react";
import { T, useLanguage } from "@/components/LanguageProvider";

type H2HHeroProps = {
  weekKey: string;
  playerCount: number;
  slateCount: number;
  activeSlate: number;
};

export default function H2HHero({ weekKey, playerCount, slateCount, activeSlate }: H2HHeroProps) {
  const { language } = useLanguage();
  const isFa = language === "fa";
  const safeSlateCount = Math.max(1, slateCount);
  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-white/[.09] bg-[#101914] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] md:px-7 md:py-6">
      <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 start-[28%] h-48 w-48 rounded-full bg-emerald-950/60 blur-3xl" />
      <div className="pointer-events-none absolute inset-y-0 end-0 w-1/2 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(90deg,transparent,black)]" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="flex min-w-0 items-center gap-4">
          <motion.div initial={{ scale: .86, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-brand/35 bg-brand/15 text-brand shadow-[0_0_34px_rgba(32,184,121,.2)]">
            <motion.span animate={{ scale: [1, 1.18, 1], opacity: [.45, .1, .45] }} transition={{ duration: 2.8, repeat: Infinity }} className="absolute inset-0 rounded-2xl border border-brand/40" />
            <Swords size={25} strokeWidth={2.2} />
          </motion.div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate text-2xl font-black tracking-tight text-white md:text-[2rem]"><T fa="رو در رو" en="Head to Head" /></h1>
              <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.18em] text-brand"><T fa="رقابت هفتگی" en="Weekly duel" /></span>
            </div>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/55"><T fa="هر شب یک رقیب؛ هر امتیاز یک قدم تا صدر." en="One opponent each slate. Every point moves you up." /></p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/65"><UsersRound size={14} className="text-brand" /><span className="font-black text-white">{playerCount}</span><span><T fa="بازیکن" en="players" /></span></div>
          <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/65 sm:flex"><span className="font-black text-white">{weekKey}</span></div>
        </div>
      </div>
      <div className="relative mt-6 border-t border-white/[.08] pt-4">
        <div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[.18em] text-white/35"><span>{isFa ? `هفته · اسلیت ${activeSlate} از ${safeSlateCount}` : `Week · Slate ${activeSlate} of ${safeSlateCount}`}</span><span className="inline-flex items-center gap-1 text-brand"><T fa="مسیر رقابت" en="Race progress" /><ArrowUpRight size={12} /></span></div>
        <div className="relative flex items-center justify-between gap-2">
          <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/10" />
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, Math.max(0, (activeSlate - 1) / Math.max(1, safeSlateCount - 1))) }} transition={{ duration: .75, ease: "easeOut" }} className="absolute start-2 top-1/2 h-px w-[calc(100%-16px)] origin-start -translate-y-1/2 bg-brand shadow-[0_0_12px_rgba(32,184,121,.8)]" />
          {Array.from({ length: safeSlateCount }, (_, index) => { const slate = index + 1; const active = slate === activeSlate; const complete = slate < activeSlate; return <div key={slate} className="relative z-10 flex min-w-0 flex-1 justify-center"><motion.div initial={{ scale: .7, opacity: 0 }} animate={{ scale: active ? 1.08 : 1, opacity: 1 }} transition={{ delay: index * .05 }} className={`grid h-7 w-7 place-items-center rounded-full border text-[10px] font-black transition ${active ? "border-brand bg-brand text-[#06120c] shadow-[0_0_18px_rgba(32,184,121,.65)]" : complete ? "border-brand/50 bg-brand/25 text-brand" : "border-white/15 bg-[#101914] text-white/40"}`}>{slate}</motion.div></div>; })}
        </div>
      </div>
    </section>
  );
}
