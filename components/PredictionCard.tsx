"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Crown, Minus, Plus, Radio, Sparkles, X } from "lucide-react";
import { formatIranDate, formatIranTime } from "@/lib/football/time";
import { teamName } from "@/lib/football/team-names";
import { useLanguage } from "@/components/LanguageProvider";
import { TeamCrest } from "./TeamCrest";

type Team = { id: number; name: string; logoUrl: string | null };
type Match = { providerMatchId: string; kickoffAt: Date | string; status: string; homeGoals?: number | null; awayGoals?: number | null; homeTeam: Team; awayTeam: Team };
type Props = { match: Match; initial?: { homeGoals: number; awayGoals: number }; index?: number };

export function PredictionCard({ match, initial, index = 0 }: Props) {
  const { language, t } = useLanguage();
  const [now, setNow] = useState(Date.now());
  const [home, setHome] = useState(initial?.homeGoals?.toString() ?? "");
  const [away, setAway] = useState(initial?.awayGoals?.toString() ?? "");
  const [saved, setSaved] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const kickoff = new Date(match.kickoffAt).getTime();
  const estimatedEnd = kickoff + 120 * 60_000;
  const hasResult = match.homeGoals !== null && match.homeGoals !== undefined && match.awayGoals !== null && match.awayGoals !== undefined;
  const finished = match.status === "FINISHED" || (now >= estimatedEnd && match.status !== "POSTPONED");
  const live = !finished && (match.status === "LIVE" || (now >= kickoff && now < estimatedEnd));
  const locked = live || finished;
  const theme = index % 2 === 0 ? "from-[#10a069] via-[#075b3d] to-[#031e16]" : "from-[#164f3b] via-[#0d2c21] to-[#06150f]";
  const homeName = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const awayName = teamName(language, match.awayTeam.id, match.awayTeam.name);
  const statusText = live ? "LIVE" : finished ? `FT${hasResult ? ` · ${match.homeGoals} - ${match.awayGoals}` : ""}` : "UPCOMING";
  const update = (setter: (value: string) => void) => (value: string) => { setSaved(false); setter(value); };
  const submit = async () => {
    if (home === "" || away === "" || locked) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/predictions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ matchId: match.providerMatchId, homeGoals: Number(home), awayGoals: Number(away) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? t("ذخیره پیش‌بینی انجام نشد", "Prediction could not be saved"));
      setSaved(true); setDrawerOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("ذخیره پیش‌بینی انجام نشد", "Prediction could not be saved")); }
    finally { setBusy(false); }
  };
  const openMobileDrawer = () => { if (!locked) setDrawerOpen(true); };
  return <>
    <motion.article initial={{ opacity: 0, y: 18, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .45, delay: index * .06, ease: [0.22, 1, .36, 1] }} whileHover={{ y: -5 }} onClick={(event) => { if (window.innerWidth < 768 && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement)) openMobileDrawer(); }} className={`match-card-notch group relative mb-5 overflow-hidden rounded-[18px] bg-gradient-to-br ${theme} shadow-[0_24px_70px_rgba(0,0,0,.4)]`}>
      <div className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-white/15 blur-3xl" /><div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      <div className="relative rounded-[17px] bg-gradient-to-b from-white/[.1] to-black/[.08] px-[18px] pb-12 pt-[18px] backdrop-blur-xl md:px-5 md:pt-5">
        <div className="mb-3 flex items-center justify-between text-[10px] font-bold text-white/75"><span className="inline-flex items-center gap-1.5"><Crown size={13} className="text-[#e8c66a]" />{t("مسابقه رسمی", "Official match")}</span><span className={`${live ? "rounded-full bg-red-500 px-2.5 py-1 text-white shadow-[0_0_18px_rgba(239,68,68,.45)]" : "rounded-full bg-black/25 px-2.5 py-1"}`}>{live && <i className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}{statusText}</span></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><TeamBlock name={homeName} sourceName={match.homeTeam.name} logo={match.homeTeam.logoUrl} /><div className="text-center"><div className="mb-2 text-[9px] font-black tracking-wide text-white/65">{t("پیش‌بینی شما", "YOUR PICK")}</div><div className="hidden items-center gap-1.5 bg-black/25 p-1.5 shadow-inner md:flex"><ScoreInput value={home} setValue={update(setHome)} disabled={locked} /><b className="text-white/70">:</b><ScoreInput value={away} setValue={update(setAway)} disabled={locked} /></div><button type="button" onClick={openMobileDrawer} className="flex min-w-32 flex-col items-center bg-black/20 px-3 py-2 text-[10px] font-bold text-white/80 md:hidden">{!live && !finished ? <Countdown remaining={kickoff - now} /> : live ? <><Radio size={15} className="mb-1 animate-pulse text-red-300" />LIVE</> : <><span className="text-lg font-black">{hasResult ? `${match.homeGoals} - ${match.awayGoals}` : "FT"}</span><span>{t("نتیجه نهایی", "Full time")}</span></>}<ChevronDown size={13} className="mt-1 text-white/50" /></button></div><TeamBlock name={awayName} sourceName={match.awayTeam.name} logo={match.awayTeam.logoUrl} /></div>
        <div className="mt-4 text-center text-[10px] font-bold text-white/65">{formatIranDate(match.kickoffAt, language === "fa" ? "fa-IR" : "en-GB")} · {formatIranTime(match.kickoffAt, language === "fa" ? "fa-IR" : "en-GB")}</div>
        {error && <p role="alert" className="mt-3 bg-red-950/25 p-2 text-center text-[10px] text-red-100">{error}</p>}
      </div>
      <button disabled={busy || home === "" || away === "" || locked} onClick={submit} className="absolute bottom-0 left-1/2 z-20 hidden min-w-40 -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-[#050706] px-5 py-2.5 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 md:flex">{locked ? statusText : saved ? <><Check size={14} className="text-brand" />{t("ذخیره شد", "Saved")}</> : <><Sparkles size={14} className="text-[#e8c66a]" />{busy ? t("در حال ثبت…", "Saving…") : t("ثبت پیش‌بینی", "Save prediction")}</>}</button>
    </motion.article>
    {drawerOpen && <PredictionDrawer home={{ name: homeName, logo: match.homeTeam.logoUrl }} away={{ name: awayName, logo: match.awayTeam.logoUrl }} homeValue={home} awayValue={away} setHome={update(setHome)} setAway={update(setAway)} onClose={() => setDrawerOpen(false)} onSubmit={submit} busy={busy} saved={saved} error={error} locked={locked} language={language} />}
  </>;
}

function TeamBlock({ name, sourceName, logo }: { name: string; sourceName: string; logo: string | null }) { return <div className="flex min-w-0 flex-col items-center gap-2 text-center"><div className="grid h-16 w-16 place-items-center"><TeamCrest name={sourceName} logo={logo} /></div><span className="line-clamp-2 max-w-28 text-xs font-black text-white">{name}</span></div>; }
function ScoreInput({ value, setValue, disabled }: { value: string; setValue: (value: string) => void; disabled: boolean }) { return <input disabled={disabled} value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 2))} className="h-10 w-10 bg-white/95 text-center text-xl font-black text-[#0b211a] outline-none transition focus:ring-2 focus:ring-[#e8c66a] disabled:opacity-65" />; }

function Countdown({ remaining }: { remaining: number }) { const total = Math.max(0, Math.floor(remaining / 1000)); const values = [Math.floor(total / 86400), Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60]; return <div className="flex items-center gap-1" dir="ltr">{values.map((value, index) => <div key={index} className="flex items-center gap-0.5"><Digit value={String(value).padStart(2, "0")[0]} /><Digit value={String(value).padStart(2, "0")[1]} />{index < 3 && <span className="mx-0.5 text-white/45">:</span>}</div>)}</div>; }
function Digit({ value }: { value: string }) { return <span className="relative grid h-7 w-5 overflow-hidden place-items-center rounded-[5px] bg-white/[.12] text-[13px] font-black text-white"><AnimatePresence mode="popLayout" initial={false}><motion.span key={value} initial={{ y: 9, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -9, opacity: 0 }} transition={{ duration: .18 }} className="absolute">{value}</motion.span></AnimatePresence></span>; }

type DrawerTeam = { name: string; logo: string | null };
function PredictionDrawer({ home, away, homeValue, awayValue, setHome, setAway, onClose, onSubmit, busy, saved, error, locked, language }: { home: DrawerTeam; away: DrawerTeam; homeValue: string; awayValue: string; setHome: (v: string) => void; setAway: (v: string) => void; onClose: () => void; onSubmit: () => void; busy: boolean; saved: boolean; error: string; locked: boolean; language: "fa" | "en" }) { const t = (fa: string, en: string) => language === "fa" ? fa : en; return <div className="fixed inset-0 z-[80] md:hidden"><button aria-label={t("بستن", "Close")} onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-md" /><motion.div initial={{ y: "100%", opacity: .7 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[22px] bg-[#0d1713] p-5 pb-8 shadow-[0_-24px_90px_rgba(0,0,0,.65)]"><div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_15%_10%,rgba(18,160,105,.35),transparent_28%),linear-gradient(135deg,transparent_45%,rgba(255,255,255,.035)_45%,transparent_46%),linear-gradient(45deg,transparent_55%,rgba(18,160,105,.05)_55%,transparent_56%)] [background-size:auto,42px_42px,42px_42px]" /><div className="relative"><div className="mx-auto mb-5 h-1 w-10 bg-white/20" /><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black tracking-[.22em] text-brand">{t("پیش‌بینی مسابقه", "MATCH PREDICTION")}</p><h2 className="mt-1 text-lg font-black text-white">{t("نتیجه را انتخاب کنید", "Choose the final score")}</h2></div><button onClick={onClose} className="bg-white/10 p-2 text-white/70"><X size={18} /></button></div><div className="grid grid-cols-2 gap-3"><DrawerTeamCard team={home} value={homeValue} setValue={setHome} disabled={locked} delay={0} /><DrawerTeamCard team={away} value={awayValue} setValue={setAway} disabled={locked} delay={.08} /></div>{error && <p role="alert" className="mt-3 text-center text-xs text-red-300">{error}</p>}<button disabled={busy || homeValue === "" || awayValue === "" || locked} onClick={onSubmit} className="mt-5 flex w-full items-center justify-center gap-2 bg-brand py-3.5 text-sm font-black transition hover:bg-brand-hover disabled:opacity-50">{saved ? <><Check size={15} />{t("ذخیره شد", "Saved")}</> : busy ? t("در حال ثبت…", "Saving…") : t("ثبت پیش‌بینی", "Save prediction")}</button></div></motion.div></div>; }
function DrawerTeamCard({ team, value, setValue, disabled, delay }: { team: DrawerTeam; value: string; setValue: (v: string) => void; disabled: boolean; delay: number }) { return <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: .35 }} className="flex flex-col items-center bg-black/25 p-3"><div className="mb-2 grid h-14 w-14 place-items-center"><TeamCrest name={team.name} logo={team.logo} /></div><span className="line-clamp-2 min-h-8 text-center text-xs font-black text-white">{team.name}</span><Stepper value={value} setValue={setValue} disabled={disabled} /></motion.div>; }
function Stepper({ value, setValue, disabled }: { value: string; setValue: (v: string) => void; disabled: boolean }) { const number = Number(value || 0); return <div className="mt-3 flex items-center gap-2"><button type="button" disabled={disabled || number <= 0} onClick={() => setValue(String(Math.max(0, number - 1)))} className="grid h-8 w-8 place-items-center bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"><Minus size={14} /></button><span className="grid h-9 w-9 place-items-center bg-white text-xl font-black text-[#0b211a]">{value || "0"}</span><button type="button" disabled={disabled} onClick={() => setValue(String(Math.min(20, number + 1)))} className="grid h-8 w-8 place-items-center bg-white/10 text-white transition hover:bg-white/20"><Plus size={14} /></button></div>; }
