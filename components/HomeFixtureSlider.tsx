"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MatchEmptyState } from "@/components/MatchEmptyState";
import type { MatchRecord } from "@/lib/football/data";
import { PredictionCard } from "@/components/PredictionCard";
import { useLanguage } from "@/components/LanguageProvider";

export function HomeFixtureSlider({
  matches,
  predictions = {},
  allPredicted = false,
  layout = "slider",
}: {
  matches: MatchRecord[];
  predictions?: Record<string, { homeGoals: number; awayGoals: number }>;
  allPredicted?: boolean;
  layout?: "slider" | "grid";
}) {
  const [index, setIndex] = useState(0);
  const [predictionOpen, setPredictionOpen] = useState(false);
  const [predictionMap, setPredictionMap] = useState(predictions);
  const { language } = useLanguage();
  const visibleMatches = matches.filter(
    (match) => !predictionMap[match.providerMatchId],
  );
  const count = visibleMatches.length;
  useEffect(() => {
    setPredictionMap((current) => ({ ...current, ...predictions }));
  }, [predictions]);
  useEffect(() => {
    setIndex((current) => (count ? Math.min(current, count - 1) : 0));
  }, [count]);
  useEffect(() => {
    if (layout === "grid" || count < 2 || predictionOpen) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % count),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [count, predictionOpen, layout]);
  if (!count)
    return (
      <MatchEmptyState
        variant={allPredicted || matches.length > 0 ? "complete" : "upcoming"}
        compact
      />
    );
  if (layout === "grid")
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleMatches.map((match, cardIndex) => (
          <div key={match.providerMatchId} className="min-w-0">
            <PredictionCard
              match={match}
              index={cardIndex}
              onPredictionSaved={(prediction) =>
                setPredictionMap((current) => ({
                  ...current,
                  [match.providerMatchId]: prediction,
                }))
              }
            />
          </div>
        ))}
      </div>
    );
  const go = (direction: number) =>
    setIndex((current) => (current + direction + count) % count);
  const activeMatch = visibleMatches[Math.min(index, count - 1)];
  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-x-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeMatch.providerMatchId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="pt-4">
            <PredictionCard
              match={activeMatch}
              initial={predictionMap[activeMatch.providerMatchId]}
              index={index}
              onDrawerChange={setPredictionOpen}
              onPredictionSaved={(prediction) =>
                setPredictionMap((current) => ({
                  ...current,
                  [activeMatch.providerMatchId]: prediction,
                }))
              }
            />
          </div>
        </motion.div>
      </AnimatePresence>
      {count > 1 && (
        <div className="mt-1 flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => go(language === "en" ? -1 : 1)}
            aria-label="Previous fixture"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white transition hover:border-brand/60 hover:text-brand"
          >
            {language === "en" ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
          <div className="flex items-center gap-1.5">
            {visibleMatches.map((match, dot) => (
              <button
                key={match.providerMatchId}
                type="button"
                aria-label={`Fixture ${dot + 1}`}
                onClick={() => setIndex(dot)}
                className={`h-1.5 rounded-full transition-all ${dot === index ? "w-7 bg-brand" : "w-1.5 bg-white/25"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(language === "en" ? 1 : -1)}
            aria-label="Next fixture"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white transition hover:border-brand/60 hover:text-brand"
          >
            {language === "en" ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
