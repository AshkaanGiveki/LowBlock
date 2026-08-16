"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MatchRecord } from "@/lib/football/data";
import { PredictionCard } from "@/components/PredictionCard";
import { T } from "@/components/LanguageProvider";

export function HomeFixtureSlider({ matches }: { matches: MatchRecord[] }) {
  const [index, setIndex] = useState(0);
  const [predictionOpen, setPredictionOpen] = useState(false);
  const count = matches.length;
  useEffect(() => {
    if (count < 2 || predictionOpen) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => window.clearInterval(timer);
  }, [count, predictionOpen]);
  if (!count) return <div className="rounded-[30px] border border-dashed border-white/10 bg-black/20 p-12 text-center text-sm text-white/50"><T fa="در انتظار مسابقه رسمی بعدی" en="Waiting for the next official fixture" /></div>;
  const go = (direction: number) => setIndex((current) => (current + direction + count) % count);
  return <div className="relative mx-auto w-full max-w-2xl overflow-x-hidden">
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={matches[index].providerMatchId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2, ease: [0.22, 1, .36, 1] }}>
        <PredictionCard match={matches[index]} index={index} onDrawerChange={setPredictionOpen} />
      </motion.div>
    </AnimatePresence>
    {count > 1 && <div className="mt-1 flex items-center justify-between px-2"><button type="button" onClick={() => go(1)} aria-label="Previous fixture" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white transition hover:border-brand/60 hover:text-brand"><ChevronRight size={16} /></button><div className="flex items-center gap-1.5">{matches.map((match, dot) => <button key={match.providerMatchId} type="button" aria-label={`Fixture ${dot + 1}`} onClick={() => setIndex(dot)} className={`h-1.5 rounded-full transition-all ${dot === index ? "w-7 bg-brand" : "w-1.5 bg-white/25"}`} />)}</div><button type="button" onClick={() => go(-1)} aria-label="Next fixture" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white transition hover:border-brand/60 hover:text-brand"><ChevronLeft size={16} /></button></div>}
  </div>;
}
