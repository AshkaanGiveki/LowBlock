"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Swords } from "lucide-react";
import { T } from "@/components/LanguageProvider";

type H2HHeroProps = {
  slateCount: number;
  activeSlate: number;
  progressSlate?: number;
};

export default function H2HHero({ slateCount, activeSlate, progressSlate }: H2HHeroProps) {
  const safeSlateCount = Math.max(1, slateCount);
  const raceSlate = Math.min(safeSlateCount, Math.max(1, progressSlate ?? activeSlate));
  const progressRatio = (raceSlate - 1) / Math.max(1, safeSlateCount - 1);
  const edgePercent = 50 / safeSlateCount;
  const trackWidth = Math.max(0, 100 - edgePercent * 2);

  return (
    <section className="relative isolate overflow-hidden rounded-[1.6rem] border border-white/[.09] bg-[#101914] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,.22)] md:px-7 md:py-5">
      <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 start-[28%] h-48 w-48 rounded-full bg-emerald-950/60 blur-3xl" />
      <div className="pointer-events-none absolute inset-y-0 end-0 w-1/2 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(90deg,transparent,black)]" />

      <div className="relative flex items-center gap-4">
        <motion.div initial={{ scale: .86, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-brand/35 bg-brand/15 text-brand shadow-[0_0_34px_rgba(32,184,121,.2)]">
          <motion.span animate={{ scale: [1, 1.18, 1], opacity: [.45, .1, .45] }} transition={{ duration: 2.8, repeat: Infinity }} className="absolute inset-0 rounded-2xl border border-brand/40" />
          <Swords size={22} strokeWidth={2.2} />
        </motion.div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="truncate text-2xl font-black tracking-tight text-white md:text-[2rem]"><T fa="رو در رو" en="Head to Head" /></h1>
            <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.18em] text-brand"><T fa="حالت رقابتی" en="Competitive mode" /></span>
          </div>
        </div>
      </div>

      <div className="relative mt-4 border-t border-white/[.08] pt-3">
        <div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[.18em] text-white/35">
          <span><T fa={`هفته · اسلیت ${raceSlate} از ${safeSlateCount}`} en={`Week · Slate ${raceSlate} of ${safeSlateCount}`} /></span>
          <span className="inline-flex items-center gap-1 text-brand"><T fa="مسیر رقابت" en="Race progress" /><ArrowUpRight size={12} /></span>
        </div>
        <div className="relative flex items-center">
          <div className="absolute top-1/2 h-px -translate-y-1/2 bg-white/10" style={{ insetInlineStart: `${edgePercent}%`, width: `${trackWidth}%` }} />
          <motion.div initial={{ width: 0 }} animate={{ width: `${trackWidth * progressRatio}%` }} transition={{ duration: .75, ease: "easeOut" }} className="absolute top-1/2 h-px -translate-y-1/2 bg-brand shadow-[0_0_12px_rgba(32,184,121,.8)]" style={{ insetInlineStart: `${edgePercent}%` }} />
          {Array.from({ length: safeSlateCount }, (_, index) => {
            const slate = index + 1;
            const active = slate === raceSlate;
            const complete = slate < raceSlate;
            return <div key={slate} className="relative z-10 flex min-w-0 flex-1 justify-center"><motion.div initial={{ scale: .7, opacity: 0 }} animate={{ scale: active ? 1.08 : 1, opacity: 1 }} transition={{ delay: index * .05 }} className={`grid h-7 w-7 place-items-center rounded-full border text-[10px] font-black transition ${active ? "border-brand bg-brand text-[#06120c] shadow-[0_0_18px_rgba(32,184,121,.65)]" : complete ? "border-brand/50 bg-[#13231a] text-brand" : "border-white/15 bg-[#101914] text-white/40"}`}>{slate}</motion.div></div>;
          })}
        </div>
      </div>
    </section>
  );
}
