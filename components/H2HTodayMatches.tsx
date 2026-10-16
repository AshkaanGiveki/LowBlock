"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Star } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { PredictionDrawer } from "@/components/PredictionCard";
import { T, useLanguage } from "@/components/LanguageProvider";
import { TeamCrest } from "@/components/TeamCrest";
import { getLeague } from "@/lib/football/leagues";
import { teamName } from "@/lib/football/team-names";
import { formatNumber } from "@/lib/text";
import vsIcon from "@/assets/icons/vs.png";

const H2H_CARD_PATTERN = `url("data:image/svg+xml,<svg id='patternId' width='100%' height='100%' xmlns='http://www.w3.org/2000/svg'><defs><pattern id='a' patternUnits='userSpaceOnUse' width='58' height='100.23' patternTransform='scale(2) rotate(0)'><rect x='0' y='0' width='100%' height='100%' fill='%23103022ff'/><path d='M12.127 73.813l.013 5.643 4.893-2.81zm-6.01-3.47l16.928 9.773-16.93 9.777zm-6.02-3.476l28.967 16.725L.13 100.262zm16.97 23.616l-.015 5.643-4.893-2.81zm6.01-3.472L6.148 96.786l16.93 9.776zM.128 100.261l28.935 16.669m16.874-23.67l-.013-5.644-4.894 2.81zm6.01 3.47L35.02 86.956l16.931-9.775zM29 83.482l28.936-16.669.032 33.393m-28.904 2.834l4.881-2.834-4.88-2.832zm0 6.94V90.433l16.932 9.773zm0 6.952V83.482l28.904 16.724zM58 13.915l-4.882 2.833L58 19.582zm0-6.94v19.548l-16.932-9.774zm0-6.951v33.448L29.096 16.748m0-13.89l4.88-2.833-4.88-2.833zm0 6.94V-9.749L46.026.025zm0 6.95v-33.449L58 .024zM16.94 23.696l-4.894-2.81-.014 5.643zm6.01-3.47L6.02 29.998V10.448zM0 33.472L.033.08 28.97 16.75m-5.99-29.92L6.053-3.393l16.93 9.776zM28.97 16.75L29-16.644.033.08m40.966 23.615l.013 5.643 4.893-2.81zm-6.01-3.47l16.928 9.774-16.93 9.775zm22.947 13.248L29 50.143l-.031-33.394M16.97 43.197l-.013-5.643-4.894 2.81zm6.01 3.47L6.053 36.894l16.93-9.776zM29 50.143L.032 33.419l28.936-16.67m16.937 57.008l-4.893-2.81-.014 5.644zm6.01-3.47L34.988 80.06v-19.55zM29 64.035l-4.88 2.832L29 69.7zm0-6.942v19.549L12.07 66.867zM.097 66.867L29 50.143v33.449m16.938-43.228l-.013 5.644-4.894-2.811zm6.01-3.47L35.02 46.667l16.931 9.777zM29 50.143l28.936 16.67.032-33.394M.097 52.975l4.88-2.832-4.88-2.833zm0 6.942V40.368l16.931 9.775zm0 6.95V33.42' stroke-linecap='square' stroke-width='1' stroke='%23182721ff' fill='none'/></pattern></defs><rect width='800%' height='800%' transform='translate(0,0)' fill='url(%23a)'/></svg>")`;
const H2H_GOLD_CARD_PATTERN = `url("data:image/svg+xml,<svg id='patternId' width='100%' height='100%' xmlns='http://www.w3.org/2000/svg'><defs><pattern id='a' patternUnits='userSpaceOnUse' width='58' height='100.23' patternTransform='scale(2) rotate(0)'><rect x='0' y='0' width='100%' height='100%' fill='%233b340cff'/><path d='M12.127 73.813l.013 5.643 4.893-2.81zm-6.01-3.47l16.928 9.773-16.93 9.777zm-6.02-3.476l28.967 16.725L.13 100.262zm16.97 23.616l-.015 5.643-4.893-2.81zm6.01-3.472L6.148 96.786l16.93 9.776zM.128 100.261l28.935 16.669m16.874-23.67l-.013-5.644-4.894 2.81zm6.01 3.47L35.02 86.956l16.931-9.775zM29 83.482l28.936-16.669.032 33.393m-28.904 2.834l4.881-2.834-4.88-2.832zm0 6.94V90.433l16.932 9.773zm0 6.952V83.482l28.904 16.724zM58 13.915l-4.882 2.833L58 19.582zm0-6.94v19.548l-16.932-9.774zm0-6.951v33.448L29.096 16.748m0-13.89l4.88-2.833-4.88-2.833zm0 6.94V-9.749L46.026.025zm0 6.95v-33.449L58 .024zM16.94 23.696l-4.894-2.81-.014 5.643zm6.01-3.47L6.02 29.998V10.448zM0 33.472L.033.08 28.97 16.75m-5.99-29.92L6.053-3.393l16.93 9.776zM28.97 16.75L29-16.644.033.08m40.966 23.615l.013 5.643 4.893-2.81zm-6.01-3.47l16.928 9.774-16.93 9.775zm22.947 13.248L29 50.143l-.031-33.394M16.97 43.197l-.013-5.643-4.894 2.81zm6.01 3.47L6.053 36.894l16.93-9.776zM29 50.143L.032 33.419l28.936-16.67m16.937 57.008l-4.893-2.81-.014 5.644zm6.01-3.47L34.988 80.06v-19.55zM29 64.035l-4.88 2.832L29 69.7zm0-6.942v19.549L12.07 66.867zM.097 66.867L29 50.143v33.449m16.938-43.228l-.013 5.644-4.894-2.811zm6.01-3.47L35.02 46.667l16.931 9.777zM29 50.143l28.936 16.67.032-33.394M.097 52.975l4.88-2.832-4.88-2.833zm0 6.942V40.368l16.931 9.775zm0 6.95V33.42'  stroke-linecap='square' stroke-width='1' stroke='%2342380aff' fill='none'/></pattern></defs><rect width='800%' height='800%' transform='translate(0,-196.92)' fill='url(%23a)'/></svg>")`;

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
    [days, "D"],
    [hours, "H"],
    [minutes, "M"],
    [remainder, "S"],
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
  const name = teamName(language, Number(team?.id ?? 0), team?.name ?? "Team", undefined, team?.faName);
  const logo = team?.logoUrl || team?.logo || (team?.id ? `/api/team-image/${team.id}` : null);
  return { name: language === "en" ? String(name ?? "Team").toUpperCase() : name ?? "Team", logo };
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
  const slateStarted = Boolean(todaySlate && new Date(todaySlate.firstKickoffAt).getTime() <= now);

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
            const primaryText = "text-white";
            const secondaryText = "text-white/70";
            const countdownPrimaryText = gold ? "text-[#211b09]" : "text-white";
            const countdownMutedText = gold ? "text-[#211b09]/60" : "text-white/50";

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
                style={{ backgroundImage: gold ? H2H_GOLD_CARD_PATTERN : H2H_CARD_PATTERN }}
              >
                <div className="p-3 pb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {competition?.logo ? <img src={competition.logo} alt="" className="h-6 w-6 shrink-0 object-contain" /> : <span className="h-6 w-6 shrink-0 rounded-full bg-white/[.06]" />}
                    </div>
                    {!slateStarted && <button type="button" aria-label={gold ? (language === "fa" ? "حذف انتخاب طلایی" : "Remove gold pick") : (language === "fa" ? "انتخاب به عنوان بازی طلایی" : "Choose as gold match")} aria-pressed={gold} disabled={goldBusy !== null} onClick={(event) => void chooseGold(event, fixture)} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${gold ? "border-[#e8c66a] bg-[#e8c66a] text-white" : "border-white/15 bg-white/[.035] text-white/35 hover:border-[#e8c66a]/70 hover:text-[#e8c66a]"}`}><Star size={14} fill={gold ? "currentColor" : "none"} /></button>}
                  </div>

                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-0">
                    <div className="flex justify-end"><TeamCrest name={homeTeam.name} logo={homeTeam.logo} className="h-11 w-11 rounded-xl" /></div>
                    <img src={vsIcon.src} alt="" aria-hidden="true" className="relative z-10 h-10 w-10 shrink-0 object-contain brightness-0 invert" />
                    <div className="flex justify-start"><TeamCrest name={awayTeam.name} logo={awayTeam.logo} className="h-11 w-11 rounded-xl" /></div>
                  </div>

                  <div className="mt-3 text-center">
                    <div className={`truncate text-[13px] font-normal leading-5 ${primaryText}`}>{homeTeam.name}</div>
                    <div className="mx-auto my-1.5 h-px w-10 bg-white/10" />
                    <div className={`truncate text-[13px] font-normal leading-5 ${secondaryText}`}>{awayTeam.name}</div>
                  </div>

                  <div className={`mt-3 flex items-center justify-center gap-2 text-[10px] font-semibold ${secondaryText}`}>
                    <span className="inline-flex items-center gap-1"><CalendarDays size={12} className="text-white/45" />{kickoff.date}</span>
                    <span className="h-1 w-1 rounded-full bg-white/25" />
                    <span className="inline-flex items-center gap-1 tabular-nums"><Clock3 size={12} className="text-white/75" />{kickoff.time}</span>
                  </div>

                </div>

                {!started && (
                  <div className={`border-t px-3 py-3 ${gold ? "border-[#211b09]/20 bg-[#e5b90b]/70" : "border-white/[.1] bg-[#06120d]/80"}`}>
                    <div className={ `mb-2 flex items-center justify-center gap-1.5 text-[8px] font-black uppercase tracking-[.16em] ${countdownMutedText}` }><Clock3 size={11} /> <T fa="زمان باقی‌مانده" en="STARTS IN" /></div>
                    <div dir="ltr" className={`grid grid-cols-4 divide-x overflow-hidden rounded-xl border ${gold ? "divide-[#211b09]/15 border-[#211b09]/20 bg-[#211b09]/[.06]" : "divide-white/10 border-white/[.1] bg-black/10"}`}>
                      {timer.map((unit) => (
                        <div key={unit.label} className="px-1 py-2 text-center">
                          <div className={`text-[17px] font-light leading-none tracking-[-.04em] tabular-nums ${countdownPrimaryText}`}>{unit.value}</div>
                          <div className={`mt-1.5 text-[8px] font-medium uppercase tracking-[.12em] ${countdownMutedText}`}>{unit.label}</div>
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
