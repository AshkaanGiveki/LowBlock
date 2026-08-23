"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { MatchRecord } from "@/lib/football/data";
import { PredictionCard } from "@/components/PredictionCard";
import { T, useLanguage } from "@/components/LanguageProvider";

export function HomeFixtureSlider({ matches, predictions = {}, allPredicted = false }: { matches: MatchRecord[]; predictions?: Record<string, { homeGoals: number; awayGoals: number }>; allPredicted?: boolean }) {
  const [index, setIndex] = useState(0);
  const [predictionOpen, setPredictionOpen] = useState(false);
  const [predictionMap, setPredictionMap] = useState(predictions);
  const { language } = useLanguage();
  const visibleMatches = matches.filter((match) => !predictionMap[match.providerMatchId]);
  const count = visibleMatches.length;
  useEffect(() => {
    setPredictionMap((current) => ({ ...current, ...predictions }));
  }, [predictions]);
  useEffect(() => {
    setIndex((current) => (count ? Math.min(current, count - 1) : 0));
  }, [count]);
  useEffect(() => {
    if (count < 2 || predictionOpen) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => window.clearInterval(timer);
  }, [count, predictionOpen]);
  if (!count) return allPredicted || matches.length > 0 ? <div className="home-all-predicted relative overflow-hidden rounded-[30px] border border-brand/25 bg-[radial-gradient(circle_at_50%_0%,rgba(32,184,121,.22),transparent_55%),linear-gradient(145deg,#142a1e,#08100b)] p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,.2)]"><div className="home-all-predicted-icon mx-auto grid h-16 w-16 place-items-center rounded-[1.35rem] border border-brand/35 bg-brand/15 text-brand shadow-[0_0_35px_rgba(32,184,121,.18)]"><CalendarCheck2 size={30}/></div><h3 className="mt-5 text-xl font-black text-white"><T fa="همه مسابقه‌های امروز را پیش‌بینی کرده‌اید" en="You’ve predicted all today’s matches" /></h3><p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-white/55"><T fa="پیش‌بینی‌های شما برای بازی‌های امروز ثبت شده است." en="Your predictions for today’s fixtures are safely recorded." /></p><Sparkles className="mx-auto mt-5 text-[#e8c66a]" size={18}/></div> : <div className="rounded-[30px] border border-dashed border-white/10 bg-black/20 p-12 text-center text-sm text-white/50"><T fa="در انتظار مسابقه رسمی بعدی" en="Waiting for the next official fixture" /></div>;
  const go = (direction: number) => setIndex((current) => (current + direction + count) % count);
  const activeMatch = visibleMatches[index];
  return <div className="relative mx-auto w-full max-w-2xl overflow-x-hidden">
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={activeMatch.providerMatchId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2, ease: [0.22, 1, .36, 1] }}>
        <div className="pt-4"><PredictionCard match={activeMatch} initial={predictionMap[activeMatch.providerMatchId]} index={index} onDrawerChange={setPredictionOpen} onPredictionSaved={(prediction) => setPredictionMap((current) => ({ ...current, [activeMatch.providerMatchId]: prediction }))} /></div>
      </motion.div>
    </AnimatePresence>
    {count > 1 && <div className="mt-1 flex items-center justify-between px-2"><button type="button" onClick={() => go(language === "en" ? -1 : 1)} aria-label="Previous fixture" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white transition hover:border-brand/60 hover:text-brand">{language === "en" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button><div className="flex items-center gap-1.5">{visibleMatches.map((match, dot) => <button key={match.providerMatchId} type="button" aria-label={`Fixture ${dot + 1}`} onClick={() => setIndex(dot)} className={`h-1.5 rounded-full transition-all ${dot === index ? "w-7 bg-brand" : "w-1.5 bg-white/25"}`} />)}</div><button type="button" onClick={() => go(language === "en" ? 1 : -1)} aria-label="Next fixture" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white transition hover:border-brand/60 hover:text-brand">{language === "en" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>}
  </div>;
}
