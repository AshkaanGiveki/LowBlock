"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { LEAGUES } from "@/lib/football/leagues";
import { PredictionCard } from "@/components/PredictionCard";
import { useLanguage } from "@/components/LanguageProvider";

type Match = React.ComponentProps<typeof PredictionCard>["match"] & { leagueCode: string };

export function MatchesView({ matches, predictions }: { matches: Match[]; predictions: Record<string, { homeGoals: number; awayGoals: number }> }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = useMemo(() => selected.length ? matches.filter((match) => selected.includes(match.leagueCode)) : matches, [matches, selected]);
  const toggle = (code: string) => setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);

  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl">
    <div className="mb-7"><p className="text-xs font-black tracking-[.18em] text-brand">{t("\u0645\u0633\u0627\u0628\u0642\u0647\u200c\u0647\u0627", "MATCHES")}</p><h1 className="mt-2 text-3xl font-black md:text-5xl">{t("\u067e\u06cc\u0634\u200c\u0628\u06cc\u0646\u06cc \u062e\u0648\u062f \u0631\u0627 \u062b\u0628\u062a \u06a9\u0646\u06cc\u062f", "Make your prediction")}</h1></div>
    <div className="mb-8 flex flex-wrap gap-2">{LEAGUES.map((league, index) => {
      const on = selected.includes(league.code);
      return <motion.button key={league.code} initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * .055, type: "spring", stiffness: 420, damping: 28 }} aria-label={league.enName} aria-pressed={on} onClick={() => toggle(league.code)} className={`relative grid h-12 w-12 place-items-center rounded-lg border transition ${on ? "border-brand bg-brand/15" : "border-white/10 bg-white/[.03] hover:border-white/25"}`}><img src={league.logo} alt="" className="league-logo h-7 w-7 object-contain" />{on && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-brand text-[#07110c]"><Check size={11} /></span>}</motion.button>;
    })}</div>
    {filtered.length ? <div className="grid gap-5 xl:grid-cols-2">{filtered.map((match, index) => <motion.div key={match.providerMatchId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .045, duration: .24 }}><PredictionCard match={match} initial={predictions[match.providerMatchId]} index={0} /></motion.div>)}</div> : <div className="rounded-xl border border-dashed border-white/15 p-14 text-center text-sm text-[var(--muted)]">{t("\u0645\u0633\u0627\u0628\u0642\u0647\u200c\u0627\u06cc \u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u0641\u06cc\u0644\u062a\u0631 \u0646\u06cc\u0633\u062a.", "No matches match this filter.")}</div>}
  </div></main>;
}
