"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BarChart3, Check, ChevronDown, Crown, Minus, Plus, Radio, Sparkles, X } from "lucide-react";
import { formatIranDate, formatIranTime } from "@/lib/football/time";
import { teamName } from "@/lib/football/team-names";
import { formatNumber } from "@/lib/text";
import { useLanguage } from "@/components/LanguageProvider";
import { TeamCrest } from "./TeamCrest";
import { MatchAnalytics } from "./MatchAnalytics";
import { MatchInsightsPanel } from "./MatchInsights";

type Team = { id: number; name: string; logoUrl: string | null };
type Match = { providerMatchId: string; kickoffAt: Date | string; status: string; homeGoals?: number | null; awayGoals?: number | null; homeTeam: Team; awayTeam: Team };
type Props = { match: Match; initial?: { homeGoals: number; awayGoals: number }; index?: number; onDrawerChange?: (open: boolean) => void };

export function PredictionCard({ match, initial, index = 0, onDrawerChange }: Props) {
  const { language, t } = useLanguage();
  const [now, setNow] = useState(Date.now());
  const [home, setHome] = useState(initial?.homeGoals?.toString() ?? "");
  const [away, setAway] = useState(initial?.awayGoals?.toString() ?? "");
  const [saved, setSaved] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const kickoff = new Date(match.kickoffAt).getTime();
  const hasResult = match.homeGoals != null && match.awayGoals != null;
  const finished = match.status === "FINISHED" || (now >= kickoff + 120 * 60_000 && match.status !== "POSTPONED");
  const live = !finished && (match.status === "LIVE" || now >= kickoff);
  const locked = live || finished;
  const homeName = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const awayName = teamName(language, match.awayTeam.id, match.awayTeam.name);
  const closeDrawer = () => { setDrawerOpen(false); onDrawerChange?.(false); };
  const open = () => { if (locked) setAnalyticsOpen(true); else { setDrawerOpen(true); onDrawerChange?.(true); } };
  const update = (setter: (value: string) => void) => (value: string) => { setSaved(false); setter(value); };
  async function submit() {
    if (home === "" || away === "" || locked) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/predictions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ matchId: match.providerMatchId, homeGoals: Number(home), awayGoals: Number(away) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? t("Ø°Ø®ÛŒØ±Ù‡ Ù†Ø´Ø¯", "Prediction could not be saved"));
      setSaved(true); closeDrawer();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("Ø®Ø·Ø§ÛŒÛŒ Ø±Ø® Ø¯Ø§Ø¯", "Something went wrong")); } finally { setBusy(false); }
  }
  const statusText = live ? "LIVE" : finished ? `FT${hasResult ? ` Â· ${formatNumber(match.homeGoals ?? 0, language)} - ${formatNumber(match.awayGoals ?? 0, language)}` : ""}` : "UPCOMING";
  return <>
    <motion.article initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4, delay: index * .05 }} whileHover={{ y: -4 }} onClick={(event) => { const target = event.target as HTMLElement; if (window.innerWidth < 768 && !target.closest("button, input")) open(); }} className="glow-card relative mb-5 overflow-hidden rounded-2xl border border-brand/30 shadow-[0_24px_70px_rgba(0,0,0,.4)]">
      <div className="relative rounded-[15px] bg-gradient-to-b from-white/[.1] to-black/[.08] px-5 pb-14 pt-5 backdrop-blur-xl"><div className="mb-4 flex items-center justify-between text-[10px] font-bold text-white/75"><span className="inline-flex items-center gap-1.5"><Crown size={13} className="text-[#e8c66a]"/>{t("Ù…Ø³Ø§Ø¨Ù‚Ù‡ Ø±Ø³Ù…ÛŒ", "Official match")}</span><span className={`rounded-full px-2.5 py-1 ${live ? "bg-red-500 text-white" : "bg-black/25"}`}>{statusText}</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><TeamBlock name={homeName} sourceName={match.homeTeam.name} logo={match.homeTeam.logoUrl}/><div className="text-center"><p className="mb-2 text-[9px] font-black tracking-wide text-white/65">{t("Ù¾ÛŒØ´â€ŒØ¨ÛŒÙ†ÛŒ Ø´Ù…Ø§", "YOUR PICK")}</p><div className="hidden items-center gap-1.5 rounded-lg bg-black/25 p-1.5 md:flex"><ScoreInput value={home} setValue={update(setHome)} disabled={locked}/><b className="text-white/70">:</b><ScoreInput value={away} setValue={update(setAway)} disabled={locked}/></div><button type="button" onClick={open} className="flex min-w-28 flex-col items-center rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-white/80 md:hidden">{live ? <><Radio size={15} className="mb-1 animate-pulse text-red-300"/>LIVE</> : finished ? <><span className="text-lg font-black">{hasResult ? `${formatNumber(match.homeGoals ?? 0, language)} - ${formatNumber(match.awayGoals ?? 0, language)}` : "FT"}</span><span>{t("Ù†ØªÛŒØ¬Ù‡ Ù†Ù‡Ø§ÛŒÛŒ", "Full time")}</span></> : <><span className="text-sm font-black">{saved ? `${formatNumber(Number(home), language)} - ${formatNumber(Number(away), language)}` : t("Ø§Ù†ØªØ®Ø§Ø¨", "Choose")}</span><span className="mt-0.5 text-white/50">{t("Ù†ØªÛŒØ¬Ù‡", "score")}</span></>}</button></div><TeamBlock name={awayName} sourceName={match.awayTeam.name} logo={match.awayTeam.logoUrl}/></div><div className="mt-4 text-center text-[10px] font-bold text-white/65">{formatIranDate(match.kickoffAt, language === "fa" ? "fa-IR" : "en-GB")} Â· {formatIranTime(match.kickoffAt, language === "fa" ? "fa-IR" : "en-GB")}</div>{error && <p role="alert" className="mt-3 rounded-lg bg-red-950/25 p-2 text-center text-[10px] text-red-100">{error}</p>}</div><button disabled={busy || home === "" || away === "" || locked} onClick={submit} className="absolute bottom-2 left-1/2 hidden min-w-40 -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-[#050706] px-5 py-2.5 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60 md:flex">{saved ? <><Check size={14} className="text-brand"/>{t("Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯", "Saved")}</> : <><Sparkles size={14} className="text-[#e8c66a]"/>{busy ? t("Ø¯Ø± Ø­Ø§Ù„ Ø«Ø¨Øª", "Savingâ€¦") : t("Ø«Ø¨Øª Ù¾ÛŒØ´â€ŒØ¨ÛŒÙ†ÛŒ", "Save prediction")}</>}</button>
    </motion.article>
    {drawerOpen && <PredictionDrawer home={{ name: homeName, logo: match.homeTeam.logoUrl }} away={{ name: awayName, logo: match.awayTeam.logoUrl }} homeValue={home} awayValue={away} setHome={update(setHome)} setAway={update(setAway)} onClose={closeDrawer} onSubmit={submit} matchId={match.providerMatchId} insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen((value) => !value)} busy={busy} saved={saved} error={error} language={language}/>} 
    {analyticsOpen && <MatchAnalytics matchId={match.providerMatchId} onClose={() => setAnalyticsOpen(false)}/>} 
  </>;
}

function TeamBlock({ name, sourceName, logo }: { name: string; sourceName: string; logo: string | null }) { return <div className="flex min-w-0 flex-col items-center gap-2 text-center"><div className="grid h-16 w-16 place-items-center"><TeamCrest name={sourceName} logo={logo}/></div><span className="line-clamp-2 max-w-28 text-xs font-black text-white">{name}</span></div>; }
function ScoreInput({ value, setValue, disabled }: { value: string; setValue: (value: string) => void; disabled: boolean }) { return <input disabled={disabled} value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 2))} className="h-10 w-10 rounded-md bg-white/95 text-center text-xl font-black text-[#0b211a] outline-none focus:ring-2 focus:ring-[#e8c66a]"/>; }
type DrawerTeam = { name: string; logo: string | null };
function PredictionDrawer({ home, away, homeValue, awayValue, setHome, setAway, onClose, onSubmit, matchId, insightsOpen, onToggleInsights, busy, saved, error, language }: { home: DrawerTeam; away: DrawerTeam; homeValue: string; awayValue: string; setHome: (value: string) => void; setAway: (value: string) => void; onClose: () => void; onSubmit: () => void; matchId: string; insightsOpen: boolean; onToggleInsights: () => void; busy: boolean; saved: boolean; error: string; language: "fa" | "en" }) {
  const t = (fa: string, en: string) => language === "fa" ? fa : en;
  const display = (value: string) => value === "" ? "—" : formatNumber(Number(value), language);
  return <div className="fixed inset-0 z-[80] md:hidden"><button type="button" aria-label={t("بستن", "Close")} onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-md"/><motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="absolute inset-x-0 bottom-0 max-h-[94vh] overflow-y-auto rounded-t-[2.25rem] border border-b-0 border-white/10 bg-[#0d1712] px-5 pb-8 pt-14 shadow-[0_-30px_100px_rgba(0,0,0,.72)]"><div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/20"/><button type="button" onClick={onClose} aria-label={t("بستن", "Close")} className="absolute left-5 top-5 grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[.07] text-white/75"><X size={18}/></button><div className="mb-7 text-center"><div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-[10px] font-black tracking-[.18em] text-brand"><BarChart3 size={13}/>{t("پیش‌بینی مسابقه", "MATCH PREDICTION")}</div><h2 className="text-2xl font-black">{t("نتیجه‌ات را ثبت کن", "Lock in your score")}</h2><p className="mt-2 text-xs text-white/50">{t("امتیاز خود را با انتخاب گل‌های هر تیم بساز.", "Choose both teams’ goals before kick-off.")}</p></div><div className="relative grid grid-cols-2 gap-3"><DrawerTeamCard team={home} value={homeValue} setValue={setHome} language={language}/><DrawerTeamCard team={away} value={awayValue} setValue={setAway} language={language}/><div className="pointer-events-none absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-brand/30 bg-[#10231a] text-xs font-black text-brand shadow-xl">{display(homeValue)}<span className="mx-0.5 text-white/40">–</span>{display(awayValue)}</div></div><div className="relative my-6"><div className="border-t border-dashed border-white/20"/><button type="button" onClick={onToggleInsights} aria-expanded={insightsOpen} className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-brand/30 bg-[#0d1712] px-3 py-1.5 text-[10px] font-black text-brand shadow-[0_0_0_5px_#0d1712] transition hover:border-brand hover:bg-brand/10"><span>{t("فرم و جدول", "Form & table")}</span><ChevronDown size={14} className={insightsOpen ? "rotate-180 transition-transform" : "transition-transform"}/></button></div>{insightsOpen && <div className="mb-5"><MatchInsightsPanel matchId={matchId}/></div>}{error && <p className="mt-4 rounded-xl bg-red-950/30 p-3 text-center text-xs text-red-200">{error}</p>}<button type="button" disabled={busy || homeValue === "" || awayValue === ""} onClick={onSubmit} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(32,184,121,.22)] disabled:opacity-45">{saved ? <><Check size={16}/>{t("ذخیره شد", "Saved")}</> : busy ? t("در حال ثبت…", "Saving…") : t("ثبت پیش‌بینی", "Save prediction")}</button></motion.div></div>;
}
function DrawerTeamCard({ team, value, setValue, language }: { team: DrawerTeam; value: string; setValue: (value: string) => void; language: "fa" | "en" }) { const n = (amount: number) => formatNumber(amount, language); return <div className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-white/[.06] to-black/20 p-4 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[.05] p-2"><TeamCrest name={team.name} logo={team.logo}/></div><p className="mt-3 line-clamp-2 min-h-8 text-xs font-bold text-white/80">{team.name}</p><div className="mt-5 flex items-center justify-center gap-2"><button type="button" aria-label="Decrease score" disabled={Number(value || 0) <= 0} onClick={() => setValue(String(Math.max(0, Number(value || 0) - 1)))} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.05] text-white/75 transition hover:border-brand hover:text-brand disabled:opacity-25"><Minus size={15}/></button><span className="grid h-12 w-12 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-2xl font-black text-brand">{value === "" ? "—" : n(Number(value))}</span><button type="button" aria-label="Increase score" onClick={() => setValue(String(Math.min(20, Number(value || 0) + 1)))} className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-[0_6px_18px_rgba(32,184,121,.25)] transition hover:bg-brand-hover"><Plus size={15}/></button></div></div>; }
