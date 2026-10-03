"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Flame,
  GripHorizontal,
  Sparkles,
  Trophy,
  Users,
  X,
  Timer,
  Target,
  MessageSquare,
  RectangleHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Tv,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { formatNumber } from "@/lib/text";
import { teamName } from "@/lib/football/team-names";
import { LocalDateTime, LocalTime } from "@/components/LocalDateTime";
import { TeamCrest } from "@/components/TeamCrest";
import type {
  LiveMatchSnapshot,
  LiveIncident,
  LiveStatGroup,
  LiveLineups,
} from "@/lib/football/sportsapi/matchMonitor";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type TabType = "lineups" | "stats" | "timeline";

type AnalyticsData = {
  match: any;
  locked: boolean;
  started?: boolean;
  liveDetails?: LiveMatchSnapshot | null;
  total: number;
  averagePoints: number;
  distribution: Array<{ score: string; count: number }>;
  users: Array<any>;
};

export function MatchAnalytics({
  matchId,
  clubId,
  initialMatch,
  onClose,
}: {
  matchId: string;
  clubId?: string;
  initialMatch?: any;
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [tab, setTab] = useState<TabType>("lineups");
  const [visible, setVisible] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);

  const query = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";
  const number = (value: number | null | undefined) =>
    formatNumber(Number(value ?? 0), language, { maximumFractionDigits: 1 });
  const score = (home: number | null, away: number | null) =>
    home == null || away == null ? "—" : `${number(home)} - ${number(away)}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/matches/${matchId}/analytics${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((next) => {
        if (!cancelled && next) {
          setData(next);
          if (["LIVE", "SUSPENDED"].includes(String(next.match?.status))) {
            if (next.liveDetails?.incidents?.length) {
              setTab("timeline");
            } else if (next.liveDetails?.stats?.length) {
              setTab("stats");
            }
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [matchId, query]);

  useEffect(() => {
    const status = String(data?.match?.status || initialMatch?.status || "");
    const shouldStream =
      Boolean(status) &&
      !["FINISHED", "CANCELLED", "POSTPONED", "VOID"].includes(status);
    if (!shouldStream) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/matches/${matchId}/live?stream=true`);

      eventSource.onopen = () => setIsLiveConnected(true);

      const applySnapshot = (snapshot: LiveMatchSnapshot) => {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            match: {
              ...prev.match,
              homeGoals: snapshot.score.home ?? prev.match.homeGoals,
              awayGoals: snapshot.score.away ?? prev.match.awayGoals,
              status: snapshot.score.status ?? prev.match.status,
              elapsed: snapshot.score.elapsed ?? prev.match.elapsed,
            },
            liveDetails: snapshot,
          };
        });
        setIsLiveConnected(true);
      };

      eventSource.addEventListener("snapshot", (e) => {
        try {
          applySnapshot(JSON.parse(e.data));
        } catch {}
      });

      eventSource.addEventListener("update", (e) => {
        try {
          applySnapshot(JSON.parse(e.data));
        } catch {}
      });

      eventSource.onerror = () => setIsLiveConnected(false);
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
      setIsLiveConnected(false);
    };
  }, [data?.match?.status, initialMatch?.status, matchId]);

  const close = () => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  };

  const match = data?.match || initialMatch;
  const liveDetails = data?.liveDetails;
  const incidents = liveDetails?.incidents ?? [];
  const statsGroups = liveDetails?.stats ?? [];
  const lineups = liveDetails?.lineups ?? null;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-hidden">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-[#020705]/90 backdrop-blur-sm"
            aria-label={t("بستن", "Close")}
          />
          <motion.section
            ref={drawerRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="relative flex flex-col h-[94dvh] w-full max-w-[640px] overflow-hidden rounded-t-[32px] border border-[#1a382d] bg-[#050b09] text-white shadow-[0_-32px_120px_rgba(0,0,0,.85)]"
          >
            {/* Drawer Header Handle */}
            <div className="flex-shrink-0 z-30 flex h-14 items-center justify-between border-b border-white/[.04] bg-[#050b09]/80 px-6 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="h-1 w-10 rounded-full bg-white/20" />
                {isLiveConnected && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#10b981] border border-[#10b981]/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t("بستن", "Close")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[.06] text-white/60 transition hover:bg-white/[.1] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {match ? (
              <div className="flex-1 overflow-y-auto overscroll-contain pb-12">
                {/* Background glowing effects */}
                <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-[#059669]/10 blur-[100px]" />
                <div className="pointer-events-none absolute -left-32 top-32 h-96 w-96 rounded-full bg-[#0d9488]/5 blur-[100px]" />

                <div className="px-5 pt-6 relative z-10">
                  <MatchHeader
                    match={match}
                    language={language}
                    number={number}
                    score={score}
                    t={t}
                  />

                  {/* 3-Tab Navigation */}
                  <div className="mt-6 flex rounded-2xl border border-[#1a382d] bg-[#07100c] p-1 shadow-[inset_0_1px_2px_rgba(255,255,255,.02)]">
                    <TabButton
                      active={tab === "lineups"}
                      onClick={() => setTab("lineups")}
                      label={t("ترکیب", "Lineup")}
                    />
                    <TabButton
                      active={tab === "stats"}
                      onClick={() => setTab("stats")}
                      label={t("آمار بازی", "Stats")}
                    />
                    <TabButton
                      active={tab === "timeline"}
                      onClick={() => setTab("timeline")}
                      label={t("رویدادها", "Events")}
                      badge={incidents.length > 0 ? formatNumber(incidents.length, language) : undefined}
                    />
                  </div>

                  <div className="mt-6">
                    {tab === "lineups" && (
                      <LineupsView
                        lineups={lineups}
                        match={match}
                        language={language}
                        t={t}
                        incidents={incidents}
                      />
                    )}

                    {tab === "stats" && (
                      <StatsView
                        statsGroups={statsGroups}
                        match={match}
                        language={language}
                        t={t}
                        data={data}
                        number={number}
                        score={score}
                      />
                    )}

                    {tab === "timeline" && (
                      <CommentaryView
                        incidents={incidents}
                        match={match}
                        language={language}
                        t={t}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <AnalyticsSkeleton />
              </div>
            )}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

function TabButton({ active, onClick, label, badge }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300",
        active ? "text-[#020705]" : "text-white/50 hover:text-white"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-tab-bg"
          className="absolute inset-0 rounded-xl bg-[#10b981] shadow-[0_0_24px_rgba(16,185,129,.3)]"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {label}
        {badge && (
          <span className={cn(
            "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
            active ? "bg-black/20 text-[#020705]" : "bg-white/10 text-white/70"
          )}>
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

/* =========================================================================
 * 1. HEADER WITH RESILIENT TEAM CRESTS
 * ========================================================================= */
function MatchHeader({ match, language, number, score, t }: any) {
  const home = teamName(language, match.homeTeam?.id, match.homeTeam?.name);
  const away = teamName(language, match.awayTeam?.id, match.awayTeam?.name);
  const finished = ["FINISHED", "FT"].includes(String(match.status));
  const live =
    !finished &&
    (["LIVE", "SUSPENDED", "IN_PLAY"].includes(String(match.status)) ||
      (match.status === "SCHEDULED" &&
        new Date(match.kickoffAt).getTime() <= Date.now()));

  const homeLogo = match.homeTeam?.logoUrl || match.homeTeam?.logo || (match.homeTeam?.id ? `/api/team-image/${match.homeTeam.id}` : null);
  const awayLogo = match.awayTeam?.logoUrl || match.awayTeam?.logo || (match.awayTeam?.id ? `/api/team-image/${match.awayTeam.id}` : null);

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[#1a382d] bg-gradient-to-b from-[#091610] to-[#050b09] p-5 md:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#10b981] uppercase">
          <TrendingUp size={12} />
          {t("تحلیل و آمار بازی", "MATCH INTELLIGENCE")}
        </span>
        <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white/60">
          {match.leagueCode ?? "FRIENDLY"}
        </span>
      </div>

      <div className="mt-6 flex items-center justify-between">
        {/* Home Team */}
        <div className="flex flex-col items-center flex-1">
          <div className="h-16 w-16 rounded-2xl border border-white/10 bg-black/40 flex items-center justify-center p-2 mb-2 shadow-[0_4px_24px_rgba(0,0,0,.5)]">
            <TeamCrest
              name={match.homeTeam?.name || home}
              logo={homeLogo}
              className="h-12 w-12 object-contain"
            />
          </div>
          <span className="text-xs font-bold text-white text-center line-clamp-2 max-w-[120px]">{home}</span>
        </div>

        {/* Score & Status */}
        <div className="flex flex-col items-center justify-center px-4">
          <div className="text-[34px] font-black tracking-tight text-white leading-none mb-1">
            {score(match.homeGoals, match.awayGoals)}
          </div>
          <Status match={match} live={live} finished={finished} number={number} />
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center flex-1">
          <div className="h-16 w-16 rounded-2xl border border-white/10 bg-black/40 flex items-center justify-center p-2 mb-2 shadow-[0_4px_24px_rgba(0,0,0,.5)]">
            <TeamCrest
              name={match.awayTeam?.name || away}
              logo={awayLogo}
              className="h-12 w-12 object-contain"
            />
          </div>
          <span className="text-xs font-bold text-white text-center line-clamp-2 max-w-[120px]">{away}</span>
        </div>
      </div>
    </div>
  );
}

function Status({ match, live, finished, number }: any) {
  const { language, t } = useLanguage();

  if (live) {
    const isRealisticElapsed = match.elapsed != null && match.elapsed > 0 && match.elapsed <= 130;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400 animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        LIVE {isRealisticElapsed && `(${number(match.elapsed)}')`}
      </span>
    );
  }
  if (finished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[.04] px-2.5 py-0.5 text-[10px] font-bold text-white/50">
        <Check size={10} className="text-[#10b981]" />
        FT
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium text-white/40">
      <LocalTime
        value={match.kickoffAt}
        locale={language === "fa" ? "fa-IR" : "en-GB"}
      />
    </span>
  );
}

/* =========================================================================
 * 2. LINEUPS VIEW
 * ========================================================================= */
function LineupsView({ lineups, match, language, t, incidents }: any) {
  const [activeSide, setActiveSide] = useState<"home" | "away">("home");

  if (!lineups || (!lineups.home?.players?.length && !lineups.away?.players?.length)) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#1a382d] p-12 text-center text-sm text-white/40">
        {t("ترکیب این مسابقه هنوز اعلام نشده است.", "Lineups are not available yet.")}
      </div>
    );
  }

  const homeName = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const awayName = teamName(language, match.awayTeam.id, match.awayTeam.name);

  const currentTeam = activeSide === "home" ? lineups.home : lineups.away;
  const isHome = activeSide === "home";

  return (
    <div className="space-y-6">
      <div className="flex rounded-xl bg-black/40 p-1 border border-white/5">
        <button
          type="button"
          onClick={() => setActiveSide("home")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
            activeSide === "home"
              ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 shadow-sm"
              : "text-white/40 hover:text-white"
          )}
        >
          {homeName} {lineups.home?.formation ? `(${lineups.home.formation})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setActiveSide("away")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
            activeSide === "away"
              ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 shadow-sm"
              : "text-white/40 hover:text-white"
          )}
        >
          {awayName} {lineups.away?.formation ? `(${lineups.away.formation})` : ""}
        </button>
      </div>

      {/* Starting XI */}
      <div>
        <div className="flex items-center justify-between px-2 mb-3">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
            {t("ترکیب اصلی", "Starting XI")}
          </span>
          <span className="text-[10px] font-bold text-white/30">
            {currentTeam?.players?.length || 0} {t("بازیکن", "Players")}
          </span>
        </div>

        <div className="divide-y divide-white/[.04] rounded-2xl border border-[#1a382d] bg-[#07100c] overflow-hidden">
          {currentTeam?.players?.map((player: any) => (
            <PlayerRow
              key={player.id}
              player={player}
              isHome={isHome}
              incidents={incidents}
            />
          ))}
        </div>
      </div>

      {/* Substitutes */}
      {currentTeam?.substitutes?.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
              {t("نیمکت‌نشینان", "Substitutes")}
            </span>
            <span className="text-[10px] font-bold text-white/30">
              {currentTeam.substitutes.length} {t("بازیکن", "Players")}
            </span>
          </div>

          <div className="divide-y divide-white/[.04] rounded-2xl border border-[#1a382d] bg-[#07100c] overflow-hidden">
            {currentTeam.substitutes.map((player: any) => (
              <PlayerRow
                key={player.id}
                player={player}
                isHome={isHome}
                incidents={incidents}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player, isHome, incidents }: any) {
  const name = player.shortName || player.name;
  const pIncidents = incidents.filter(
    (i: any) =>
      i.isHome === isHome &&
      (i.playerName === player.name ||
        i.playerName === player.shortName ||
        i.playerInName === player.name ||
        i.playerInName === player.shortName ||
        i.playerOutName === player.name ||
        i.playerOutName === player.shortName)
  );

  return (
    <div className="flex items-center justify-between p-3.5 hover:bg-white/[.02] transition-colors">
      <div className="flex items-center gap-3">
        <span className="w-6 text-center text-xs font-mono font-bold text-white/30">
          {player.number || "—"}
        </span>
        <span className="text-xs font-medium text-white/90">{name}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {pIncidents.map((inc: any, i: number) => {
          if (inc.type === "goal") {
            return (
              <span key={i} className="text-xs" title={`Goal ${inc.time}'`}>
                ⚽
              </span>
            );
          }
          if (inc.type === "card") {
            return (
              <span
                key={i}
                className={cn(
                  "w-2.5 h-3.5 rounded-sm inline-block shadow-sm",
                  inc.cardType === "red" ? "bg-red-500" : "bg-amber-400"
                )}
                title={`Card ${inc.time}'`}
              />
            );
          }
          if (inc.type === "substitution") {
            const isSubIn = inc.playerInName === player.name || inc.playerInName === player.shortName;
            return (
              <span
                key={i}
                className={cn(
                  "text-[10px] font-bold px-1 py-0.2 rounded border",
                  isSubIn
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                )}
                title={`Sub ${inc.time}'`}
              >
                {isSubIn ? "↑" : "↓"} {inc.time}'
              </span>
            );
          }
          return null;
        })}
        {player.position && (
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest pl-2">
            {player.position}
          </span>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
 * 3. STATS VIEW
 * ========================================================================= */
function translateStatName(name: string, language: "fa" | "en") {
  if (language !== "fa") return name;
  const map: Record<string, string> = {
    "Ball Possession": "مالکیت توپ",
    "Total Shots": "مجموع شوت‌ها",
    "Shots On Goal": "شوت در چارچوب",
    "Shots on target": "شوت در چارچوب",
    "Shots Off Goal": "شوت خارج از چارچوب",
    "Shots off target": "شوت خارج از چارچوب",
    "Blocked Shots": "شوت‌های مسدود شده",
    "Corner Kicks": "کرنرها",
    "Offsides": "آفسایدها",
    "Fouls": "خطاها",
    "Yellow Cards": "کارت‌های زرد",
    "Red Cards": "کارت‌های قرمز",
    "Goalkeeper Saves": "مهار دروازه‌بان",
    "Total passes": "مجموع پاس‌ها",
    "Accurate Passes": "پاس‌های صحیح",
    "Passes %": "دقت پاس",
    "Free Kicks": "ضربات آزاد",
    "Throw-ins": "پرتاب‌های اوت",
  };
  return map[name] || name;
}

function StatsView({ statsGroups, match, language, t, data, number, score }: any) {
  if (!statsGroups || statsGroups.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#1a382d] p-12 text-center text-sm text-white/40">
        {t("آمار دقیق بازی هنوز ثبت نشده است.", "Detailed statistics are not available.")}
      </div>
    );
  }

  const homeName = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const awayName = teamName(language, match.awayTeam.id, match.awayTeam.name);

  const allStats = statsGroups.flatMap((g: any) => g.items);

  const possessionStat = allStats.find((s: any) => s.name?.includes("Possession"));
  const otherStats = allStats.filter((s: any) => !s.name?.includes("Possession"));

  return (
    <div className="space-y-6 pb-6">
      <div className="flex justify-between items-center px-4 mb-2">
        <span className="text-[10px] font-bold text-white/50 uppercase tracking-wide">{homeName}</span>
        <span className="text-[10px] font-bold text-white/50 uppercase tracking-wide">{awayName}</span>
      </div>

      {possessionStat && (
        <div className="px-2">
          <StatComparison stat={possessionStat} isHighlight={true} language={language} />
        </div>
      )}

      <div className="bg-[#07100c] border border-[#1a382d] rounded-[24px] p-4 space-y-5">
        {otherStats.slice(0, 12).map((stat: any, idx: number) => (
          <StatComparison key={idx} stat={stat} language={language} />
        ))}
      </div>
    </div>
  );
}

function StatComparison({ stat, isHighlight, language }: any) {
  const homeStr = String(stat.home || "0").replace("%", "");
  const awayStr = String(stat.away || "0").replace("%", "");
  const hVal = Number(stat.homeValue ?? parseFloat(homeStr)) || 0;
  const aVal = Number(stat.awayValue ?? parseFloat(awayStr)) || 0;

  const total = hVal + aVal || 1;
  const hPct = (hVal / total) * 100;
  const aPct = (aVal / total) * 100;

  return (
    <div className={cn("flex flex-col gap-2", isHighlight && "p-4 bg-[#07100c] border border-[#1a382d] rounded-[24px]")}>
      <div className="flex justify-between items-end">
        <span className="text-base font-bold text-white w-12">{stat.home}</span>
        <span className={cn("text-[11px] font-bold text-white/50 uppercase tracking-wide", isHighlight && "text-[#10b981]")}>
          {translateStatName(stat.name, language)}
        </span>
        <span className="text-base font-bold text-white w-12 text-right">{stat.away}</span>
      </div>
      <div className="flex h-1.5 w-full rounded-full bg-white/5 overflow-hidden gap-1">
        <div className="bg-gradient-to-r from-[#059669] to-[#10b981] h-full rounded-full transition-all" style={{ width: `${hPct}%` }} />
        <div className="bg-gradient-to-l from-white/10 to-white/20 h-full rounded-full transition-all" style={{ width: `${aPct}%` }} />
      </div>
    </div>
  );
}

/* =========================================================================
 * 4. COMMENTARY / MATCH EVENTS 10000x OVERHAUL
 * ========================================================================= */
type EventFilter = "all" | "goals" | "cards" | "subs";

function CommentaryView({ incidents, match, language, t }: any) {
  const [filter, setFilter] = useState<EventFilter>("all");

  if (!incidents || incidents.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#1a382d] p-12 text-center text-sm text-white/40">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#10b981]/10 text-[#10b981]">
          <Clock size={24} />
        </div>
        <p className="font-bold text-white/70 mb-1">{t("هنوز رویدادی ثبت نشده است", "No events recorded yet")}</p>
        <p className="text-xs text-white/40">{t("اتفاقات بازی (گل‌ها، کارت‌ها، تعویض‌ها) به محض رخ دادن در اینجا نمایش داده می‌شوند.", "Goals, cards, and substitutions will stream here live as they happen.")}</p>
      </div>
    );
  }

  const homeName = teamName(language, match.homeTeam?.id, match.homeTeam?.name);
  const awayName = teamName(language, match.awayTeam?.id, match.awayTeam?.name);
  const homeLogo = match.homeTeam?.logoUrl || match.homeTeam?.logo || (match.homeTeam?.id ? `/api/team-image/${match.homeTeam.id}` : null);
  const awayLogo = match.awayTeam?.logoUrl || match.awayTeam?.logo || (match.awayTeam?.id ? `/api/team-image/${match.awayTeam.id}` : null);

  // Counts for filter pills
  const goalsCount = incidents.filter((i: any) => i.type === "goal").length;
  const cardsCount = incidents.filter((i: any) => i.type === "card").length;
  const subsCount = incidents.filter((i: any) => i.type === "substitution").length;

  const filteredIncidents = incidents.filter((i: any) => {
    if (filter === "goals") return i.type === "goal";
    if (filter === "cards") return i.type === "card";
    if (filter === "subs") return i.type === "substitution";
    return true;
  });

  // Sort descending by time
  const sorted = [...filteredIncidents].sort((a: any, b: any) => {
    const timeDiff = (b.time || 0) - (a.time || 0);
    if (timeDiff !== 0) return timeDiff;
    return (b.addedTime || 0) - (a.addedTime || 0);
  });

  return (
    <div className="space-y-5 pb-16">
      {/* Event Type Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <FilterPill
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={t("همه", "All")}
          count={incidents.length}
        />
        <FilterPill
          active={filter === "goals"}
          onClick={() => setFilter("goals")}
          label={t("گل‌ها", "Goals")}
          count={goalsCount}
          icon="⚽"
        />
        <FilterPill
          active={filter === "cards"}
          onClick={() => setFilter("cards")}
          label={t("کارت‌ها", "Cards")}
          count={cardsCount}
          icon="🟨"
        />
        <FilterPill
          active={filter === "subs"}
          onClick={() => setFilter("subs")}
          label={t("تعویض‌ها", "Subs")}
          count={subsCount}
          icon="🔄"
        />
      </div>

      {/* Modern Streamlined Timeline */}
      <div className="relative pt-2">
        {/* Timeline Spine Line */}
        <div className="absolute start-6 top-3 bottom-3 w-0.5 bg-gradient-to-b from-[#10b981]/50 via-emerald-500/20 to-transparent" />

        <div className="space-y-4">
          {sorted.map((inc: any, idx: number) => {
            const isHome = inc.isHome;
            const teamTitle = isHome ? homeName : awayName;
            const teamCrestLogo = isHome ? homeLogo : awayLogo;

            // Period Marker Banner
            if (inc.type === "period") {
              return (
                <PeriodBanner
                  key={inc.id || idx}
                  detail={inc.detail}
                  time={inc.time}
                  language={language}
                  t={t}
                />
              );
            }

            // Stoppage Time Announcement
            if (inc.type === "injury_time") {
              return (
                <InjuryTimeBanner
                  key={inc.id || idx}
                  time={inc.time}
                  detail={inc.detail}
                  language={language}
                  t={t}
                />
              );
            }

            // Normal Match Event Card
            return (
              <div key={inc.id || idx} className="relative flex items-start gap-3 ps-2">
                {/* Timeline Minute Node */}
                <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#050b09] border border-[#10b981]/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                  <span className="text-[10px] font-black font-mono text-[#10b981]">
                    {inc.time}
                    {inc.addedTime ? `+${inc.addedTime}` : ""}
                    '
                  </span>
                </div>

                {/* Event Card Content */}
                <div className="flex-1 min-w-0">
                  <EventCard
                    incident={inc}
                    isHome={isHome}
                    teamTitle={teamTitle}
                    teamLogo={teamCrestLogo}
                    language={language}
                    t={t}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label, count, icon }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border",
        active
          ? "bg-[#10b981] border-[#10b981] text-[#020705] shadow-[0_0_18px_rgba(16,185,129,0.35)]"
          : "bg-white/[.04] border-white/10 text-white/60 hover:text-white hover:border-white/20"
      )}
    >
      {icon && <span className="text-xs">{icon}</span>}
      <span>{label}</span>
      <span className={cn(
        "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
        active ? "bg-black/20 text-[#020705]" : "bg-white/10 text-white/50"
      )}>
        {count}
      </span>
    </button>
  );
}

function PeriodBanner({ detail, time, language, t }: any) {
  const d = String(detail || "").toLowerCase();
  let label = detail;
  let isFullTime = false;
  let isHalfTime = false;

  if (d.includes("ft") || d.includes("ended") || d.includes("full time")) {
    label = language === "fa" ? "پایان بازی (سوت پایان)" : "Full Time";
    isFullTime = true;
  } else if (d.includes("ht") || d.includes("halftime") || d.includes("half time")) {
    label = language === "fa" ? "پایان نیمه اول" : "Half Time";
    isHalfTime = true;
  } else if (d.includes("2nd") || d.includes("second half")) {
    label = language === "fa" ? "شروع نیمه دوم" : "Second Half Started";
  } else if (d.includes("1st") || d.includes("kickoff") || d.includes("start")) {
    label = language === "fa" ? "سوت آغاز بازی" : "Match Kickoff";
  }

  return (
    <div className="relative my-4 flex items-center justify-center">
      <div className={cn(
        "relative z-10 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black tracking-wide border shadow-lg backdrop-blur-md",
        isFullTime
          ? "border-amber-400/40 bg-gradient-to-r from-amber-950/50 via-[#0e1610] to-amber-950/50 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
          : isHalfTime
            ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 via-[#07130c] to-emerald-950/50 text-[#10b981] shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            : "border-white/10 bg-[#091510] text-white/70"
      )}>
        <Timer size={13} className={isFullTime ? "text-amber-400" : "text-[#10b981]"} />
        <span>{label}</span>
      </div>
    </div>
  );
}

function InjuryTimeBanner({ time, detail, language, t }: any) {
  return (
    <div className="relative my-3 flex items-center justify-center">
      <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3.5 py-1 text-xs font-bold text-yellow-300">
        <Clock size={12} />
        <span>
          {time ? `+${time}' ` : ""}
          {language === "fa" ? "وقت تلف‌شده" : "Added Time"}
        </span>
      </div>
    </div>
  );
}

function EventCard({ incident, isHome, teamTitle, teamLogo, language, t }: any) {
  const type = incident.type;

  // GOAL CARD
  if (type === "goal") {
    const isPen = incident.detail?.toLowerCase().includes("penalty");
    const isOg = incident.detail?.toLowerCase().includes("own");

    return (
      <div className="overflow-hidden rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/40 via-[#07160f] to-[#040e0a] p-3.5 shadow-[0_4px_24px_rgba(16,185,129,0.12)] hover:border-emerald-500/60 transition-colors">
        {/* Team Chip & Category */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamCrest name={teamTitle} logo={teamLogo} className="h-4 w-4 object-contain rounded" />
            <span className="text-[11px] font-bold text-white/60 truncate">{teamTitle}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {incident.score && (
              <span className="rounded-md bg-[#10b981] px-2 py-0.5 text-xs font-black text-[#020705] shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                {incident.score.home} - {incident.score.away}
              </span>
            )}
            <span className={cn(
              "rounded px-1.5 py-0.2 text-[10px] font-extrabold uppercase tracking-wide",
              isPen
                ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                : isOg
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            )}>
              {isPen ? (language === "fa" ? "پنالتی" : "PEN") : isOg ? (language === "fa" ? "گل به خودی" : "OG") : (language === "fa" ? "گل" : "GOAL")}
            </span>
          </div>
        </div>

        {/* Scorer Info */}
        <div className="flex items-center gap-2.5">
          <span className="text-xl drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">⚽</span>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black text-white truncate">
              {incident.playerName || t("گل بازیکن", "Goal")}
            </h4>
            {incident.assistName && (
              <p className="text-[11px] text-white/50 flex items-center gap-1 mt-0.5">
                <span className="text-emerald-400 font-bold">↳</span>
                <span>{language === "fa" ? "پاس گل:" : "Assist:"}</span>
                <span className="text-white/80 font-medium">{incident.assistName}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CARD EVENT
  if (type === "card") {
    const isRed = incident.cardType === "red";
    const isYellowRed = incident.cardType === "yellow_red";

    return (
      <div className={cn(
        "overflow-hidden rounded-2xl border p-3.5 transition-colors",
        isRed
          ? "border-red-500/40 bg-gradient-to-br from-red-950/35 via-[#110708] to-[#0a0405] shadow-[0_4px_24px_rgba(239,68,68,0.12)]"
          : isYellowRed
            ? "border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-[#100c06] to-[#0a0703]"
            : "border-amber-500/30 bg-gradient-to-br from-amber-950/25 via-[#0e0c06] to-[#070603] shadow-[0_4px_20px_rgba(234,179,8,0.08)]"
      )}>
        {/* Team Chip & Category */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamCrest name={teamTitle} logo={teamLogo} className="h-4 w-4 object-contain rounded" />
            <span className="text-[11px] font-bold text-white/60 truncate">{teamTitle}</span>
          </div>

          <span className={cn(
            "rounded px-1.5 py-0.2 text-[10px] font-extrabold uppercase tracking-wide border",
            isRed
              ? "bg-red-500/20 text-red-300 border-red-500/30"
              : isYellowRed
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-amber-400/20 text-amber-300 border-amber-400/30"
          )}>
            {isRed
              ? (language === "fa" ? "کارت قرمز مستقیم" : "RED CARD")
              : isYellowRed
                ? (language === "fa" ? "کارت زرد دوم (اخراج)" : "2ND YELLOW")
                : (language === "fa" ? "کارت زرد" : "YELLOW CARD")}
          </span>
        </div>

        {/* Player and Reason */}
        <div className="flex items-center gap-3">
          {/* Card Graphic */}
          <div className="flex-shrink-0">
            {isYellowRed ? (
              <div className="relative w-5 h-6">
                <span className="absolute top-0 start-0 w-3.5 h-5 rounded-[2px] bg-gradient-to-tr from-amber-500 to-yellow-300 border border-yellow-200/50 shadow-md transform -rotate-12" />
                <span className="absolute top-0.5 start-2 w-3.5 h-5 rounded-[2px] bg-gradient-to-tr from-red-600 to-rose-400 border border-red-200/50 shadow-md transform rotate-12" />
              </div>
            ) : isRed ? (
              <span className="block w-4 h-5.5 rounded-[2px] bg-gradient-to-tr from-red-600 to-rose-400 border border-red-200/50 shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
            ) : (
              <span className="block w-4 h-5.5 rounded-[2px] bg-gradient-to-tr from-amber-500 to-yellow-300 border border-yellow-200/50 shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black text-white truncate">
              {incident.playerName || t("بازیکن", "Player")}
            </h4>
            {incident.detail && (
              <p className="text-[11px] text-white/45 truncate mt-0.5">
                {incident.detail}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // SUBSTITUTION CARD
  if (type === "substitution") {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c1410] to-[#060a08] p-3.5 shadow-md">
        {/* Team Chip & Category */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamCrest name={teamTitle} logo={teamLogo} className="h-4 w-4 object-contain rounded" />
            <span className="text-[11px] font-bold text-white/60 truncate">{teamTitle}</span>
          </div>

          <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] font-extrabold uppercase tracking-wide text-white/70 border border-white/10">
            {language === "fa" ? "تعویض" : "SUB"}
          </span>
        </div>

        {/* In and Out Players */}
        <div className="space-y-1.5">
          {/* Player In */}
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs border border-emerald-500/30">
              <ArrowUp size={12} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-white truncate block">
                {incident.playerInName || t("بازیکن ورودی", "Incoming Player")}
              </span>
            </div>
            <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              IN
            </span>
          </div>

          {/* Player Out */}
          {incident.playerOutName && (
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 grid h-5 w-5 place-items-center rounded-full bg-rose-500/20 text-rose-400 font-black text-xs border border-rose-500/30">
                <ArrowDown size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-white/60 truncate block">
                  {incident.playerOutName}
                </span>
              </div>
              <span className="text-[10px] font-extrabold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                OUT
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // VAR REVIEW CARD
  if (type === "var") {
    return (
      <div className="overflow-hidden rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-950/35 via-[#0d0917] to-[#06040c] p-3.5 shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamCrest name={teamTitle} logo={teamLogo} className="h-4 w-4 object-contain rounded" />
            <span className="text-[11px] font-bold text-white/60 truncate">{teamTitle}</span>
          </div>

          <span className="rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.2 text-[10px] font-extrabold uppercase tracking-wide">
            VAR
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
            <Tv size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate">
              {language === "fa" ? "بررسی ویدئویی (VAR)" : "VAR Review"}
            </h4>
            <p className="text-[11px] text-white/50 truncate mt-0.5">
              {incident.detail || (language === "fa" ? "بررسی تصمیم داور" : "Decision review")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT / OTHER CARD
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#07100c] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamCrest name={teamTitle} logo={teamLogo} className="h-4 w-4 object-contain rounded" />
          <span className="text-[11px] font-bold text-white/60 truncate">{teamTitle}</span>
        </div>
        <span className="text-[10px] font-mono text-white/40">{type}</span>
      </div>
      <p className="mt-1 text-xs font-medium text-white/80">
        {incident.playerName || incident.detail || t("رویداد بازی", "Match incident")}
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-32 rounded-[24px] bg-white/[.04]" />
      <div className="h-12 rounded-xl bg-white/[.04]" />
      <div className="h-64 rounded-[24px] bg-white/[.04]" />
    </div>
  );
}
