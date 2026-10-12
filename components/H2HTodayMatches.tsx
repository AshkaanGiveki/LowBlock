"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Star } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { PredictionDrawer } from "@/components/PredictionCard";
import { T, useLanguage } from "@/components/LanguageProvider";
import { TeamCrest } from "@/components/TeamCrest";
import { getLeague } from "@/lib/football/leagues";
import { formatNumber } from "@/lib/text";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function countdown(milliseconds: number, language: "fa" | "en") {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${formatNumber(hours, language, { minimumIntegerDigits: 2, useGrouping: false })}:${formatNumber(minutes, language, { minimumIntegerDigits: 2, useGrouping: false })}:${formatNumber(remainder, language, { minimumIntegerDigits: 2, useGrouping: false })}`;
}

function MatchTeam({ team, side, language }: { team: any; side: "home" | "away"; language: "fa" | "en" }) {
  const name = language === "fa" ? team?.faName || team?.name : team?.name;
  const logo = team?.logoUrl || team?.logo || (team?.id ? `/api/team-image/${team.id}` : null);
  const crest = <TeamCrest name={name ?? "Team"} logo={logo} className="h-5 w-5 rounded-lg" />;
  return <div className={`flex min-w-0 items-center gap-1.5 ${side === "home" ? "justify-end" : "justify-start"}`}>{side === "home" ? <><span className="truncate text-[10px] font-bold text-white/80">{name}</span>{crest}</> : <>{crest}<span className="truncate text-[10px] font-bold text-white/80">{name}</span></>}</div>;
}

export default function H2HTodayMatches({ slates, leagueId }: { slates: any[]; leagueId: string }) {
  const { language } = useLanguage();
  const [now, setNow] = useState(Date.now());
  const [active, setActive] = useState<any>(null);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [busy, setBusy] = useState(false);
  const [goldBusy, setGoldBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [goldByMatch, setGoldByMatch] = useState<Record<string, boolean>>({});
  const [predictions, setPredictions] = useState<Record<string, { homeGoals: number; awayGoals: number }>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todaySlate = useMemo(() => {
    const today = dayKey(new Date());
    return slates.find((slate) => slate.sourceDate === today) ?? null;
  }, [slates]);
  const fixtures = todaySlate?.fixtures ?? [];

  useEffect(() => {
    setGoldByMatch(Object.fromEntries(fixtures.map((fixture: any) => [fixture.matchId, Boolean(fixture.isGold)])));
    setPredictions(Object.fromEntries(fixtures.filter((fixture: any) => fixture.prediction).map((fixture: any) => [fixture.matchId, fixture.prediction])));
  }, [todaySlate?.matchday]);

  if (!fixtures.length || !todaySlate) return null;

  const openDrawer = (fixture: any) => {
    if (new Date(fixture.kickoffAt).getTime() <= now) return;
    const prediction = predictions[fixture.matchId] ?? fixture.prediction;
    setActive(fixture);
    setHome(prediction?.homeGoals == null ? "" : String(prediction.homeGoals));
    setAway(prediction?.awayGoals == null ? "" : String(prediction.awayGoals));
    setError("");
    setInsightsOpen(false);
  };

  const closeDrawer = () => {
    setActive(null);
    setInsightsOpen(false);
    setError("");
  };

  const savePrediction = async () => {
    if (!active || home === "" || away === "") return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/predictions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ matchId: active.matchId, homeGoals: Number(home), awayGoals: Number(away) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error === "AUTH_REQUIRED" ? (language === "fa" ? "برای ثبت پیش‌بینی وارد شوید." : "Please sign in to save your prediction.") : (language === "fa" ? "ثبت پیش‌بینی انجام نشد." : "Prediction could not be saved."));
      setPredictions((current) => ({ ...current, [active.matchId]: { homeGoals: Number(home), awayGoals: Number(away) } }));
      closeDrawer();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (language === "fa" ? "خطایی رخ داد." : "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const chooseGold = async (event: React.MouseEvent, fixture: any) => {
    event.stopPropagation();
    if (new Date(fixture.kickoffAt).getTime() <= now || goldBusy) return;
    setGoldBusy(fixture.matchId);
    setError("");
    try {
      const response = await fetch("/api/h2h/gold", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ leagueId, matchday: todaySlate.matchday, matchId: fixture.matchId }) });
      if (!response.ok) throw new Error(language === "fa" ? "انتخاب طلایی ذخیره نشد." : "Gold pick could not be saved.");
      setGoldByMatch(Object.fromEntries(fixtures.map((item: any) => [item.matchId, item.matchId === fixture.matchId])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (language === "fa" ? "خطایی رخ داد." : "Something went wrong."));
    } finally {
      setGoldBusy(null);
    }
  };

  const activeCompetition = active?.leagueCode ? getLeague(active.leagueCode) : undefined;
  const activePrediction = active ? predictions[active.matchId] : undefined;
  return (
    <>
      <section className="mt-5 max-w-5xl">
        <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#e8c66a]"><T fa="انتخاب‌های امروز" en="TODAY'S PICKS" /></p>
            <h2 className="mt-0.5 text-lg font-black"><T fa="بازی‌های طلایی" en="Gold match picks" /></h2>
          </div>
          <span className="text-[10px] text-white/35">{fixtures.length} <T fa="بازی" en="matches" /></span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fixtures.map((fixture: any) => {
            const startsAt = new Date(fixture.kickoffAt).getTime();
            const started = startsAt <= now;
            const gold = Boolean(goldByMatch[fixture.matchId]);
            const competition = getLeague(fixture.leagueCode);
            return (
              <article key={fixture.matchId} onClick={() => openDrawer(fixture)} className={`group flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition ${gold ? "border-[#e8c66a]/70 bg-[linear-gradient(135deg,rgba(232,198,106,.22),rgba(32,184,121,.06))] shadow-[0_10px_28px_rgba(232,198,106,.10)]" : "border-white/[.08] bg-[#101713] hover:border-brand/35 hover:bg-brand/[.05]"} ${started ? "cursor-default opacity-70" : "cursor-pointer"}`}>
                {competition?.logo ? <img src={competition.logo} alt="" className="h-5 w-5 shrink-0 object-contain" /> : <span className="h-5 w-5 shrink-0 rounded-full bg-white/[.06]" />}
                <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                  <MatchTeam team={fixture.homeTeam} side="home" language={language} />
                  <div className="grid shrink-0 place-items-center text-center">
                    <span className="text-[8px] font-black uppercase tracking-[.12em] text-white/25">VS</span>
                    {!started && <span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-black tabular-nums text-brand"><Clock3 size={10} />{countdown(startsAt - now, language)}</span>}
                  </div>
                  <MatchTeam team={fixture.awayTeam} side="away" language={language} />
                </div>
                <button type="button" aria-label={gold ? (language === "fa" ? "حذف انتخاب طلایی" : "Remove gold pick") : (language === "fa" ? "انتخاب به عنوان بازی طلایی" : "Choose as gold match")} aria-pressed={gold} disabled={started || goldBusy !== null} onClick={(event) => void chooseGold(event, fixture)} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${gold ? "border-[#e8c66a] bg-[#e8c66a] text-[#241d08]" : "border-white/20 bg-white/[.03] text-white/35 hover:border-[#e8c66a]/70 hover:text-[#e8c66a]"}`}><Star size={14} fill={gold ? "currentColor" : "none"} /></button>
              </article>
            );
          })}
        </div>
        {error && <p className="mt-2 rounded-lg border border-red-400/25 bg-red-950/20 px-3 py-2 text-[10px] text-red-200">{error}</p>}
      </section>
      <AnimatePresence initial={false}>
        {active && <PredictionDrawer forceVisible competition={activeCompetition} included={Boolean(activeCompetition?.globalLeaderboard)} home={{ id: active.homeTeam?.id, name: active.homeTeam?.name ?? "Home", faName: active.homeTeam?.faName, logo: active.homeTeam?.logoUrl ?? active.homeTeam?.logo ?? null }} away={{ id: active.awayTeam?.id, name: active.awayTeam?.name ?? "Away", faName: active.awayTeam?.faName, logo: active.awayTeam?.logoUrl ?? active.awayTeam?.logo ?? null }} homeValue={home} awayValue={away} setHome={setHome} setAway={setAway} onClose={closeDrawer} onSubmit={() => void savePrediction()} matchId={active.matchId} insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen((value) => !value)} busy={busy} saved={Boolean(activePrediction && Number(home) === activePrediction.homeGoals && Number(away) === activePrediction.awayGoals)} error={error} language={language} />}
      </AnimatePresence>
    </>
  );
}
