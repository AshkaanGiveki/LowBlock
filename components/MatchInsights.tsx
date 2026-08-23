"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, History, RefreshCw, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatNumber } from "@/lib/text";
import { TeamCrest } from "@/components/TeamCrest";

type H2HMeeting = { fixtureId: string; date: string; homeTeam: { id: number; name: string; logoUrl: string | null }; awayTeam: { id: number; name: string; logoUrl: string | null }; homeGoals: number; awayGoals: number; league: string };
export type MatchInsightsData = { h2h: H2HMeeting[] };

export function MatchInsightsPanel({ matchId }: { matchId: string }) {
  const { language, t } = useLanguage();
  const [data, setData] = useState<MatchInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    fetch(`/api/matches/${encodeURIComponent(matchId)}/insights`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((value) => { if (mounted) setData({ h2h: Array.isArray(value?.h2h) ? value.h2h : [] }); })
      .catch(() => { if (mounted) setError(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [matchId]);
  const n = (value: number) => formatNumber(value, language);
  if (loading) return <InsightsSkeleton />;
  if (error || !data) return <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center"><RefreshCw className="mx-auto mb-2 text-brand" size={21} /><p className="text-xs text-[var(--muted)]">{t("اطلاعات رودررو هنوز آماده نیست.", "Head-to-head data is not available yet.")}</p></div>;
  return <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden"><H2HCard data={data.h2h} language={language} n={n} t={t} /></motion.div>;
}

export function MatchInsights({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const { t } = useLanguage();
  return <AnimatePresence><div className="fixed inset-0 z-[95] flex items-end justify-center"><motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-label={t("بستن", "Close")} /><motion.section initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[2.25rem] border border-b-0 border-white/10 bg-[#0b100d] px-5 pb-10 pt-14 shadow-2xl"><button type="button" onClick={onClose} className="absolute left-5 top-5 grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[.06]" aria-label={t("بستن", "Close")}><X size={18} /></button><div className="mb-5 text-center"><span className="inline-flex items-center gap-2 text-[10px] font-black tracking-[.16em] text-brand"><Sparkles size={13} />{t("سابقه رودررو", "H2H HISTORY")}</span><h2 className="mt-2 text-2xl font-black">{t("پنج رویارویی آخر", "Last five meetings")}</h2></div><MatchInsightsPanel matchId={matchId} /></motion.section></div></AnimatePresence>;
}

function H2HCard({ data, language, n, t }: { data: H2HMeeting[]; language: "fa" | "en"; n: (value: number) => string; t: (fa: string, en: string) => string }) {
  const summary = data.reduce((acc, item) => { if (item.homeGoals > item.awayGoals) acc.home++; else if (item.homeGoals < item.awayGoals) acc.away++; else acc.draw++; return acc; }, { home: 0, draw: 0, away: 0 });
  return <section className="overflow-hidden rounded-[1.35rem] border border-brand/20 bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.16),transparent_45%),rgba(0,0,0,.16)]"><div className="flex items-center gap-3 border-b border-white/[.07] p-3.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand"><History size={19} /></span><div><h3 className="text-sm font-black">{t("پنج رویارویی آخر", "LAST FIVE MEETINGS")}</h3><p className="mt-1 text-[9px] text-[var(--muted)]">{t("سابقه مستقیم دو تیم", "Direct history between the teams")}</p></div><span className="ms-auto text-[10px] font-black text-[var(--muted)]">{n(data.length)} {t("بازی", "matches")}</span></div><div className="grid grid-cols-3 gap-2 p-3 text-center"><div className="rounded-xl bg-brand/10 p-2"><b className="block text-lg text-brand">{n(summary.home)}</b><small className="text-[9px] text-[var(--muted)]">{t("برد میزبان", "Home wins")}</small></div><div className="rounded-xl bg-white/[.04] p-2"><b className="block text-lg">{n(summary.draw)}</b><small className="text-[9px] text-[var(--muted)]">{t("مساوی", "Draws")}</small></div><div className="rounded-xl bg-red-400/10 p-2"><b className="block text-lg text-red-300">{n(summary.away)}</b><small className="text-[9px] text-[var(--muted)]">{t("برد مهمان", "Away wins")}</small></div></div><div className="px-4 pb-3">{data.length ? data.map((item) => <div key={item.fixtureId} className="flex items-center gap-2 border-t border-white/[.05] py-2.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[.05] p-1"><TeamCrest name={item.homeTeam.name} logo={item.homeTeam.logoUrl} /></span><span className="min-w-0 flex-1 truncate text-[11px] font-bold">{item.homeTeam.name}</span><b className="shrink-0 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[11px]">{n(item.homeGoals)} - {n(item.awayGoals)}</b><span className="min-w-0 flex-1 truncate text-end text-[11px] font-bold">{item.awayTeam.name}</span><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[.05] p-1"><TeamCrest name={item.awayTeam.name} logo={item.awayTeam.logoUrl} /></span><time className="hidden w-16 text-end text-[9px] text-[var(--muted)] sm:block">{new Date(item.date).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB", { month: "short", day: "numeric" })}</time></div>) : <p className="p-4 text-center text-xs text-[var(--muted)]">{t("سابقه رودررو موجود نیست.", "No head-to-head history available.")}</p>}</div></section>;
}

function InsightsSkeleton() { return <div className="space-y-3"><div className="h-16 animate-pulse rounded-[1.35rem] bg-white/[.06]" /><div className="h-56 animate-pulse rounded-[1.35rem] bg-white/[.06]" /></div>; }
