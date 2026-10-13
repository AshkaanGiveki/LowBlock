"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Star } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { PredictionDrawer } from "@/components/PredictionCard";
import { T, useLanguage } from "@/components/LanguageProvider";
import { TeamCrest } from "@/components/TeamCrest";
import { getLeague } from "@/lib/football/leagues";
import { formatNumber } from "@/lib/text";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function countdownParts(milliseconds: number, language: "fa" | "en") {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  return [
    [days, language === "fa" ? "روز" : "D"],
    [hours, language === "fa" ? "ساعت" : "H"],
    [minutes, language === "fa" ? "دقیقه" : "M"],
    [remainder, language === "fa" ? "ثانیه" : "S"],
  ].map(([value, label]) => ({
    value: formatNumber(value as number, language, { minimumIntegerDigits: 2, useGrouping: false }),
    label,
  }));
}

function formatKickoff(dateValue: string, language: "fa" | "en") {
  const date = new Date(dateValue);
  const locale = language === "fa" ? "fa-IR" : "en-GB";
  return {
    date: new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Asia/Tehran" }).format(date),
    time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }).format(date),
  };
}

function teamDetails(team: any, language: "fa" | "en") {
  const name = language === "fa" ? team?.faName || team?.name : team?.name;
  const logo = team?.logoUrl || team?.logo || (team?.id ? `/api/team-image/${team.id}` : null);
  return { name: name ?? "Team", logo };
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
  const fixtures = useMemo(() => [...(todaySlate?.fixtures ?? [])].sort((a: any, b: any) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()), [todaySlate]);

  useEffect(() => {
    setGoldByMatch(Object.fromEntries(fixtures.map((fixture: any) => [fixture.matchId, Boolean(fixture.isGold)])));
    setPredictions(Object.fromEntries(fixtures.filter((fixture: any) => fixture.prediction).map((fixture: any) => [fixture.matchId, fixture.prediction])));
  }, [fixtures]);

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

        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {fixtures.map((fixture: any) => {
            const startsAt = new Date(fixture.kickoffAt).getTime();
            const started = startsAt <= now;
            const gold = Boolean(goldByMatch[fixture.matchId]);
            const competition = getLeague(fixture.leagueCode);
            const kickoff = formatKickoff(fixture.kickoffAt, language);
            const timer = countdownParts(startsAt - now, language);
            const homeTeam = teamDetails(fixture.homeTeam, language);
            const awayTeam = teamDetails(fixture.awayTeam, language);

            return (
              <article
                key={fixture.matchId}
                role="button"
                tabIndex={started ? -1 : 0}
                aria-label={`${homeTeam.name} vs ${awayTeam.name}`}
                aria-disabled={started}
                onClick={() => openDrawer(fixture)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDrawer(fixture);
                  }
                }}
                className={`group relative w-[218px] shrink-0 snap-start overflow-hidden rounded-2xl border bg-[#101713] transition ${gold ? "border-[#e8c66a]/70" : "border-white/[.1] hover:border-brand/45"} ${started ? "cursor-default opacity-65" : "cursor-pointer"}`}
                style={{ backgroundImage: "radial-gradient(circle at 18% 12%, rgba(52, 206, 139, .13) 0, transparent 30%), radial-gradient(circle at 90% 30%, rgba(232, 198, 106, .08) 0, transparent 28%), linear-gradient(135deg, rgba(255,255,255,.025) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.025) 50%, rgba(255,255,255,.025) 75%, transparent 75%)", backgroundSize: "auto, auto, 18px 18px" }}
              >
                <div className="p-3 pb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {competition?.logo ? <img src={competition.logo} alt="" className="h-6 w-6 shrink-0 object-contain" /> : <span className="h-6 w-6 shrink-0 rounded-full bg-white/[.06]" />}
                      <span className="max-w-[112px] truncate text-[9px] font-bold text-white/60">{language === "fa" ? competition?.faName : competition?.enName}</span>
                    </div>
                    <button type="button" aria-label={gold ? (language === "fa" ? "حذف انتخاب طلایی" : "Remove gold pick") : (language === "fa" ? "انتخاب به عنوان بازی طلایی" : "Choose as gold match")} aria-pressed={gold} disabled={started || goldBusy !== null} onClick={(event) => void chooseGold(event, fixture)} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${gold ? "border-[#e8c66a] bg-[#e8c66a] text-[#241d08]" : "border-white/15 bg-white/[.035] text-white/35 hover:border-[#e8c66a]/70 hover:text-[#e8c66a]"}`}><Star size={14} fill={gold ? "currentColor" : "none"} /></button>
                  </div>

                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="flex justify-center"><TeamCrest name={homeTeam.name} logo={homeTeam.logo} className="h-11 w-11 rounded-xl" /></div>
                    <div className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-[#0b1510]/80 text-[9px] font-black uppercase tracking-[.08em] text-white/55 shadow-[0_0_0_4px_rgba(255,255,255,.025)]">VS</div>
                    <div className="flex justify-center"><TeamCrest name={awayTeam.name} logo={awayTeam.logo} className="h-11 w-11 rounded-xl" /></div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/[.08] bg-[#08110c]/55 px-3 py-2.5 text-center">
                    <div className="truncate text-[11px] font-black leading-4 text-white/90">{homeTeam.name}</div>
                    <div className="mx-auto my-1.5 h-px w-10 bg-white/10" />
                    <div className="truncate text-[11px] font-bold leading-4 text-white/55">{awayTeam.name}</div>
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-semibold text-white/55">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={12} className="text-white/35" />{kickoff.date}</span>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span className="inline-flex items-center gap-1 tabular-nums"><Clock3 size={12} className="text-brand" />{kickoff.time}</span>
                  </div>

                  <div className="mt-3 rounded-full border border-white/10 bg-white/[.055] px-3 py-2 text-center text-[9px] font-black uppercase tracking-[.08em] text-white/75 transition group-hover:border-brand/35 group-hover:text-white">
                    <T fa="پیش‌نمایش بازی" en="PRE-MATCH PREVIEW" />
                  </div>
                </div>

                {!started && (
                  <div className="border-t border-white/[.08] bg-[#07100b]/90 px-3 py-2.5">
                    <div className="mb-2 flex items-center justify-center gap-1.5 text-[8px] font-black uppercase tracking-[.16em] text-brand/80"><Clock3 size={11} /> <T fa="زمان باقی‌مانده" en="STARTS IN" /></div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {timer.map((unit) => (
                        <div key={unit.label} className="rounded-lg border border-white/[.08] bg-white/[.045] px-1 py-1.5 text-center">
                          <div className="text-[15px] font-black leading-none tabular-nums text-white">{unit.value}</div>
                          <div className="mt-1 text-[8px] font-bold uppercase tracking-[.08em] text-white/40">{unit.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
