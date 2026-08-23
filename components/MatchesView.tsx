"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { LEAGUES } from "@/lib/football/leagues";
import { MatchAnalyticsCard } from "@/components/MatchAnalyticsCard";
import { useLanguage } from "@/components/LanguageProvider";

type Match = React.ComponentProps<typeof MatchAnalyticsCard>["match"] & { leagueCode: string };

export function MatchesView({ matches, predictions }: { matches: Match[]; predictions: Record<string, { homeGoals: number; awayGoals: number }> }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = useMemo(() => selected.length ? matches.filter((match) => selected.includes(match.leagueCode)) : matches, [matches, selected]);

  return (
    <main className="desktop-predict-page min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="desktop-page-heading mb-7">
          <p className="text-xs font-black tracking-[.18em] text-brand">{t("مسابقه‌ها", "MATCHES")}</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">{t("پیش‌بینی خود را ثبت کنید", "Make your prediction")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t("یک نتیجه برای هر مسابقه ثبت کنید و در تمام جدول‌های LowBlock رقابت کنید.", "Make one prediction for each fixture and compete across every LowBlock leaderboard.")}</p>
        </div>
        <div className="desktop-league-filter mb-8 flex flex-wrap gap-2">
          {LEAGUES.map((league, index) => {
            const on = selected.includes(league.code);
            return <motion.button key={league.code} initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * .055 }} aria-pressed={on} aria-label={league.enName} onClick={() => setSelected((current) => on ? current.filter((code) => code !== league.code) : [...current, league.code])} className={`relative grid h-12 w-12 place-items-center rounded-lg border ${on ? "border-brand bg-brand/15" : "border-white/10 bg-white/[.03]"}`}><img src={league.logo} alt="" className="league-logo h-7 w-7 object-contain" />{on && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-brand"><Check size={11} /></span>}</motion.button>;
          })}
        </div>
        {filtered.length ? <div className="desktop-match-grid grid gap-5 xl:grid-cols-2">{filtered.map((match, index) => <motion.div key={match.providerMatchId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .045 }}><MatchAnalyticsCard match={match} initial={predictions[match.providerMatchId]} index={index} /></motion.div>)}</div> : <div className="rounded-xl border border-dashed border-white/15 p-14 text-center text-sm text-[var(--muted)]">{t("مسابقه‌ای برای این فیلتر نیست.", "No matches match this filter.")}</div>}
      </div>
    </main>
  );
}
