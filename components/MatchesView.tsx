"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { LEAGUES } from "@/lib/football/leagues";
import { MatchAnalyticsCard } from "@/components/MatchAnalyticsCard";
import { useLanguage, T } from "@/components/LanguageProvider";

type Match = React.ComponentProps<typeof MatchAnalyticsCard>["match"] & { leagueCode: string };
type Tab = "open" | "started";

function stateOf(match: Match, now: number) {
  const kickoff = new Date(match.kickoffAt).getTime();
  const finished = match.status === "FINISHED" || (now >= kickoff + 120 * 60_000 && match.status !== "POSTPONED");
  const live = !finished && (match.status === "LIVE" || (match.status === "SCHEDULED" && now >= kickoff));
  return { finished, live, started: live || finished || match.status === "SUSPENDED" };
}

export function MatchesView({ matches, predictions, focusMatchId, initialTab = "open" }: { matches: Match[]; predictions: Record<string, { homeGoals: number; awayGoals: number }>; focusMatchId?: string; initialTab?: Tab }) {
  const { t } = useLanguage(); const pathname = usePathname(); const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]); const [tab, setTab] = useState<Tab>(initialTab);
  const availableLeagues = useMemo(() => LEAGUES.filter((league) => matches.some((match) => match.leagueCode === league.code)), [matches]);
  const filtered = useMemo(() => {
    const now = Date.now();
    const visible = matches.filter((match) => { const selectedLeague = !selected.length || selected.includes(match.leagueCode); const state = stateOf(match, now); return selectedLeague && (tab === "open" ? !state.started : state.started); });
    return [...visible].sort((a, b) => { const as = stateOf(a, now); const bs = stateOf(b, now); if (tab === "started" && as.live !== bs.live) return Number(bs.live) - Number(as.live); return Number(!LEAGUES.find((league) => league.code === a.leagueCode)?.globalLeaderboard) - Number(!LEAGUES.find((league) => league.code === b.leagueCode)?.globalLeaderboard) || new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(); });
  }, [matches, selected, tab]);
  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => { if (!focusMatchId) return; const timer = window.setTimeout(() => document.querySelector(`[data-match-id="${CSS.escape(focusMatchId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80); return () => window.clearTimeout(timer); }, [focusMatchId, tab, filtered.length]);
  const changeTab = (next: Tab) => { setTab(next); const query = new URLSearchParams(window.location.search); query.set("tab", next); router.replace(`${pathname}?${query.toString()}`, { scroll: false }); };
  return <main className="desktop-predict-page min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl"><div className="desktop-page-heading mb-7"><p className="text-xs font-black tracking-[.18em] text-brand">{t("مسابقه‌ها", "MATCHES")}</p><h1 className="mt-2 text-3xl font-black md:text-5xl">{t("پیش‌بینی خود را ثبت کنید", "Make your prediction")}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t("یک نتیجه برای هر مسابقه ثبت کنید و در تمام جدول‌های LowBlock رقابت کنید.", "Make one prediction for each fixture and compete across every LowBlock leaderboard.")}</p></div><section className="mb-6 rounded-[1.75rem] border border-white/[.08] bg-[#101512] p-3 shadow-[0_16px_50px_rgba(0,0,0,.16)] md:p-4"><div className="mb-3 flex items-center justify-between px-1"><p className="text-[10px] font-black tracking-[.18em] text-[var(--muted)]">{t("وضعیت مسابقه‌ها", "MATCH STATUS")}</p><span className="text-xs text-brand">{tab === "open" ? t("آماده پیش‌بینی", "Prediction open") : t("زنده و پایان‌یافته", "Live & finished")}</span></div><div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[.07] bg-black/20 p-1">{(["open", "started"] as const).map((value) => <button key={value} type="button" onClick={() => changeTab(value)} className={`relative rounded-xl px-2 py-3 text-center text-sm font-black ${tab === value ? "text-white" : "text-[var(--muted)]"}`} aria-pressed={tab === value}>{tab === value && <motion.span layoutId="matches-tab" className="absolute inset-0 rounded-xl bg-brand" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}<span className="relative z-10"><T fa={value === "open" ? "مسابقه‌های پیش‌رو" : "زنده و نتایج"} en={value === "open" ? "Upcoming matches" : "Live & results"} /></span></button>)}</div></section><div className="desktop-league-filter mb-8 flex flex-wrap gap-2">{availableLeagues.map((league, index) => { const on = selected.includes(league.code); return <motion.button key={league.code} initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * .055 }} aria-pressed={on} aria-label={league.enName} onClick={() => setSelected((current) => on ? current.filter((code) => code !== league.code) : [...current, league.code])} className={`relative grid h-12 w-12 place-items-center rounded-lg border ${on ? "border-brand bg-brand/15" : "border-white/10 bg-white/[.03]"}`}><img src={league.logo} alt="" className="h-7 w-7 object-contain" />{on && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-brand"><Check size={11} /></span>}</motion.button>; })}</div>{filtered.length ? <div className="desktop-match-grid grid gap-5 xl:grid-cols-2">{filtered.map((match, index) => <motion.div key={match.providerMatchId} data-match-id={match.providerMatchId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .045 }}><MatchAnalyticsCard match={match} initial={predictions[match.providerMatchId]} index={index} openOnMount={focusMatchId === match.providerMatchId} /></motion.div>)}</div> : <div className="rounded-xl border border-dashed border-white/15 p-14 text-center text-sm text-[var(--muted)]">{t("مسابقه‌ای برای این فیلتر نیست.", "No matches match this filter.")}</div>}</div></main>;
}
