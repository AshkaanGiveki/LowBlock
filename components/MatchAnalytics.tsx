"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { formatNumber } from "@/lib/text";
import { teamName } from "@/lib/football/team-names";
import { LocalDateTime } from "@/components/LocalDateTime";
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
  onClose,
}: {
  matchId: string;
  clubId?: string;
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [tab, setTab] = useState<TabType>("lineups");
  const [visible, setVisible] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);

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
    const isLive = ["LIVE", "SUSPENDED"].includes(String(data?.match?.status));
    if (!isLive) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/matches/${matchId}/live?stream=true`);

      eventSource.onopen = () => setIsLiveConnected(true);

      eventSource.addEventListener("update", (e) => {
        try {
          const snapshot: LiveMatchSnapshot = JSON.parse(e.data);
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
        } catch {}
      });

      eventSource.onerror = () => setIsLiveConnected(false);
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
      setIsLiveConnected(false);
    };
  }, [data?.match?.status, matchId]);

  const close = () => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start === null || !drawerRef.current || drawerRef.current.scrollTop > 2)
      return;
    if ((event.changedTouches[0]?.clientY ?? start) - start > 110) close();
  };

  const liveDetails = data?.liveDetails;
  const incidents = liveDetails?.incidents ?? [];
  const statsGroups = liveDetails?.stats ?? [];
  const lineups = liveDetails?.lineups ?? null;
  const match = data?.match;

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
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="relative flex flex-col h-[94dvh] w-full max-w-[600px] overflow-hidden rounded-t-[32px] border border-[#1a382d] bg-[#050b09] text-white shadow-[0_-32px_120px_rgba(0,0,0,.8)]"
          >
            {/* Drawer Header Handle */}
            <div className="flex-shrink-0 z-30 flex h-14 items-center justify-between border-b border-white/[.04] bg-[#050b09]/80 px-6 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="h-1 w-10 rounded-full bg-white/20" />
                {isLiveConnected && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/10 px-2 py-0.5 text-[10px] font-bold text-[#10b981] border border-[#10b981]/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
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

            {data && match ? (
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
                      label={t("Lineup", "Lineup")}
                    />
                    <TabButton
                      active={tab === "stats"}
                      onClick={() => setTab("stats")}
                      label={t("Stats", "Stats")}
                    />
                    <TabButton
                      active={tab === "timeline"}
                      onClick={() => setTab("timeline")}
                      label={t("Commentary", "Commentary")}
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

function TabButton({ active, onClick, label }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-1 items-center justify-center py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300",
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
      <span className="relative z-10">{label}</span>
    </button>
  );
}

/* =========================================================================
 * 1. HEADER
 * ========================================================================= */
function MatchHeader({ match, language, number, score, t }: any) {
  const home = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const away = teamName(language, match.awayTeam.id, match.awayTeam.name);
  const finished = ["FINISHED", "FT"].includes(String(match.status));
  const live =
    !finished &&
    (["LIVE", "SUSPENDED"].includes(String(match.status)) ||
      (match.status === "SCHEDULED" &&
        new Date(match.kickoffAt).getTime() <= Date.now()));

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[#1a382d] bg-gradient-to-b from-[#091610] to-[#050b09] p-5 md:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#10b981] uppercase">
          <TrendingUp size={12} />
          {t("MATCH INTELLIGENCE", "MATCH INTELLIGENCE")}
        </span>
        <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white/60">
          {match.leagueCode ?? "FRIENDLY"}
        </span>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex flex-col items-center flex-1">
          <div className="h-14 w-14 rounded-full border border-white/10 bg-black/30 flex items-center justify-center p-2 mb-2 shadow-[0_4px_20px_rgba(0,0,0,.4)]">
            <Image
              src={match.homeTeam.logoUrl ?? "/icon.png"}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>
          <span className="text-xs font-bold text-white text-center">{home}</span>
        </div>

        <div className="flex flex-col items-center justify-center px-4">
          <div className="text-[32px] font-black tracking-tight text-white leading-none mb-1">
            {score(match.homeGoals, match.awayGoals)}
          </div>
          <Status match={match} live={live} finished={finished} number={number} />
        </div>

        <div className="flex flex-col items-center flex-1">
          <div className="h-14 w-14 rounded-full border border-white/10 bg-black/30 flex items-center justify-center p-2 mb-2 shadow-[0_4px_20px_rgba(0,0,0,.4)]">
            <Image
              src={match.awayTeam.logoUrl ?? "/icon.png"}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>
          <span className="text-xs font-bold text-white text-center">{away}</span>
        </div>
      </div>
      
      <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-white/40 font-medium">
        <CalendarDays size={12} className="text-white/30" />
        <LocalDateTime
          value={match.kickoffAt}
          locale={language === "fa" ? "fa-IR" : "en-GB"}
        />
      </div>
    </div>
  );
}

function Status({ match, live, finished, number }: any) {
  if (live)
    return (
      <div className="text-xs font-bold text-[#10b981] flex items-center gap-1 animate-pulse">
        {match.elapsed != null && `${number(match.elapsed)}'`}
      </div>
    );
  if (finished)
    return (
      <div className="text-[11px] font-bold text-white/40">
        FT
      </div>
    );
  return (
    <div className="text-[11px] font-bold text-white/40">
      {match.status}
    </div>
  );
}

/* =========================================================================
 * 2. LINEUPS VIEW
 * ========================================================================= */
function LineupsView({ lineups, match, language, t, incidents }: any) {
  const [selectedSide, setSelectedSide] = useState<"home" | "away">("home");

  if (!lineups || (!lineups.home.players.length && !lineups.away.players.length)) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#1a382d] p-12 text-center text-sm text-white/40">
        {t("Lineups are not available yet.", "Lineups are not available yet.")}
      </div>
    );
  }

  const activeLineup = selectedSide === "home" ? lineups.home : lineups.away;
  const homeName = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const awayName = teamName(language, match.awayTeam.id, match.awayTeam.name);
  const formationStr = activeLineup.formation || "4-3-3";

  return (
    <div className="space-y-4">
      {/* Team Selector */}
      <div className="flex rounded-xl border border-[#1a382d] bg-[#07100c] p-1">
        <button
          onClick={() => setSelectedSide("home")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-colors",
            selectedSide === "home"
              ? "bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20"
              : "text-white/40 hover:text-white/70"
          )}
        >
          {homeName}
        </button>
        <button
          onClick={() => setSelectedSide("away")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-colors",
            selectedSide === "away"
              ? "bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20"
              : "text-white/40 hover:text-white/70"
          )}
        >
          {awayName}
        </button>
      </div>

      <div className="flex justify-between items-center px-2">
        <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Formation</span>
        <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded border border-[#10b981]/20">
          {formationStr}
        </span>
      </div>

      {/* Football Pitch */}
      <div className="relative w-full aspect-[2/3] rounded-[24px] border border-[#1a382d] bg-[#0a1a12] overflow-hidden p-4">
        {/* Pitch Lines (SVG overlay) */}
        <svg
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
          viewBox="0 0 100 150"
          preserveAspectRatio="none"
        >
          {/* Outer line */}
          <rect x="2" y="2" width="96" height="146" fill="none" stroke="#10b981" strokeWidth="0.5" />
          {/* Halfway line */}
          <line x1="2" y1="75" x2="98" y2="75" stroke="#10b981" strokeWidth="0.5" />
          {/* Center circle */}
          <circle cx="50" cy="75" r="10" fill="none" stroke="#10b981" strokeWidth="0.5" />
          <circle cx="50" cy="75" r="0.5" fill="#10b981" />
          
          {/* Top Penalty Area */}
          <rect x="20" y="2" width="60" height="20" fill="none" stroke="#10b981" strokeWidth="0.5" />
          {/* Top Goal Area */}
          <rect x="35" y="2" width="30" height="8" fill="none" stroke="#10b981" strokeWidth="0.5" />
          {/* Top Penalty Arc */}
          <path d="M 40 22 A 10 10 0 0 0 60 22" fill="none" stroke="#10b981" strokeWidth="0.5" />
          {/* Top Penalty Spot */}
          <circle cx="50" cy="15" r="0.5" fill="#10b981" />

          {/* Bottom Penalty Area */}
          <rect x="20" y="128" width="60" height="20" fill="none" stroke="#10b981" strokeWidth="0.5" />
          {/* Bottom Goal Area */}
          <rect x="35" y="140" width="30" height="8" fill="none" stroke="#10b981" strokeWidth="0.5" />
          {/* Bottom Penalty Arc */}
          <path d="M 40 128 A 10 10 0 0 1 60 128" fill="none" stroke="#10b981" strokeWidth="0.5" />
          {/* Bottom Penalty Spot */}
          <circle cx="50" cy="135" r="0.5" fill="#10b981" />
        </svg>

        {/* Players on Pitch */}
        <div className="absolute inset-0 p-4">
          <PitchPlayers
            players={activeLineup.players}
            formation={formationStr}
            incidents={incidents}
            isHome={selectedSide === "home"}
            isPersian={language === "fa"}
          />
        </div>
      </div>

      {/* Substitutes */}
      {activeLineup.substitutes.length > 0 && (
        <div className="mt-6">
          <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 px-2">
            {t("Substitutes", "Substitutes")}
          </h4>
          <div className="flex overflow-x-auto gap-3 pb-4 snap-x hide-scrollbar px-2">
            {activeLineup.substitutes.map((sub: any) => (
              <SubPlayerCard key={sub.id} player={sub} incidents={incidents} isHome={selectedSide === "home"} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function parseFormation(formation: string) {
  const parts = formation.split("-").map(Number);
  if (parts.length === 3) return [1, parts[0], parts[1], parts[2]]; // e.g. 4-3-3 -> GK, DEF, MID, FWD
  if (parts.length === 4) return [1, parts[0], parts[1], parts[2], parts[3]];
  if (parts.length === 5) return [1, parts[0], parts[1], parts[2], parts[3], parts[4]];
  return [1, 4, 3, 3]; // Default fallback
}

function PitchPlayers({ players, formation, incidents, isHome, isPersian }: any) {
  // Simple heuristic to distribute players on grid rows
  const rows = parseFormation(formation);
  
  // Try to use positions if available, otherwise fallback to formation count
  let playersByRow: any[][] = Array.from({ length: rows.length }, () => []);
  
  if (players.length >= 11) {
    let pIdx = 0;
    // GK
    playersByRow[0].push(players[0]);
    pIdx++;
    // Field players
    for (let r = 1; r < rows.length; r++) {
      for (let i = 0; i < rows[r]; i++) {
        if (pIdx < players.length) {
          playersByRow[r].push(players[pIdx]);
          pIdx++;
        }
      }
    }
  } else {
    // If not full lineup, just dump them all (fallback)
    playersByRow = [players];
  }

  // If away team, we might want to invert the rows so their GK is at top. 
  // Wait, standard pitch view is home attacking top, away attacking bottom.
  // We will always draw GK at bottom for the selected team, attacking top.
  const displayRows = [...playersByRow].reverse();

  return (
    <div className="w-full h-full flex flex-col justify-between items-center z-10 relative pointer-events-none">
      {displayRows.map((rowPlayers, rIdx) => (
        <div key={rIdx} className="w-full flex justify-around items-center">
          {rowPlayers.map((p: any) => {
            const pIncidents = incidents.filter(
              (i: any) => i.isHome === isHome && (i.playerName === p.name || i.playerName === p.shortName || i.playerInName === p.name || i.playerOutName === p.name)
            );
            return (
              <PlayerNode key={p.id} player={p} incidents={pIncidents} isPersian={isPersian} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PlayerNode({ player, incidents, isPersian }: any) {
  const name = player.shortName || player.name;
  const truncName = name.length > 12 ? name.substring(0, 10) + ".." : name;

  const goals = incidents.filter((i: any) => i.type === "goal" && (i.playerName === player.name || i.playerName === player.shortName));
  const cards = incidents.filter((i: any) => i.type === "card" && (i.playerName === player.name || i.playerName === player.shortName));
  const subOut = incidents.find((i: any) => i.type === "substitution" && (i.playerOutName === player.name || i.playerOutName === player.shortName));

  return (
    <div className="flex flex-col items-center pointer-events-auto w-14">
      <div className="relative">
        <div className="w-9 h-9 rounded-full border-[1.5px] border-[#10b981] bg-[#07100c] flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
           <span className="text-xs font-black text-white">{player.number || ""}</span>
        </div>
        {/* Badges container */}
        <div className="absolute -top-2 -right-3 flex gap-0.5 z-10">
          {goals.map((_: any, i: number) => (
            <span key={`g-${i}`} className="text-sm drop-shadow-md">⚽</span>
          ))}
          {cards.map((c: any, i: number) => (
            <span key={`c-${i}`} className="w-2.5 h-3.5 rounded-[1px] shadow-sm border border-black/20" style={{ backgroundColor: c.cardType === 'red' ? '#ef4444' : '#eab308' }} />
          ))}
          {subOut && <span className="text-[10px] bg-black/60 rounded p-0.5" title="Substituted Out">🔻</span>}
        </div>
      </div>
      <div className="mt-1 px-1.5 py-0.5 rounded bg-black/50 border border-white/5 whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-[64px] text-center">
         <span className="text-[9px] font-bold text-white/90 drop-shadow-md block truncate" dir={isPersian ? "rtl" : "ltr"}>{truncName}</span>
      </div>
    </div>
  );
}

function SubPlayerCard({ player, incidents, isHome }: any) {
  const name = player.shortName || player.name;
  const pIncidents = incidents.filter(
    (i: any) => i.isHome === isHome && (i.playerName === player.name || i.playerName === player.shortName || i.playerInName === player.name || i.playerOutName === player.name)
  );
  const subIn = pIncidents.find((i: any) => i.type === "substitution" && (i.playerInName === player.name || i.playerInName === player.shortName));
  const goals = pIncidents.filter((i: any) => i.type === "goal" && (i.playerName === player.name || i.playerName === player.shortName));
  const cards = pIncidents.filter((i: any) => i.type === "card" && (i.playerName === player.name || i.playerName === player.shortName));

  return (
    <div className="flex-shrink-0 w-[100px] rounded-xl border border-[#1a382d] bg-[#07100c] p-2 flex flex-col items-center text-center snap-center relative">
      <div className="w-8 h-8 rounded-full border border-white/10 bg-black/40 flex items-center justify-center mb-1.5">
        <span className="text-[10px] font-bold text-white/50">{player.number || "-"}</span>
      </div>
      <span className="text-[10px] font-bold text-white truncate w-full">{name}</span>
      <span className="text-[8px] text-white/40 uppercase">{player.position || "SUB"}</span>
      
      {(subIn || goals.length > 0 || cards.length > 0) && (
        <div className="absolute -top-1 -right-1 flex gap-0.5 z-10 bg-black/60 rounded-full px-1 py-0.5 border border-white/5">
           {subIn && <span className="text-[10px]">🔺</span>}
           {goals.length > 0 && <span className="text-[10px]">⚽</span>}
        </div>
      )}
    </div>
  );
}


/* =========================================================================
 * 3. STATS VIEW
 * ========================================================================= */
function StatsView({ statsGroups, match, language, t, data, number, score }: any) {
  if (!statsGroups || statsGroups.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#1a382d] p-12 text-center text-sm text-white/40">
        {t("Detailed statistics are not available.", "Detailed statistics are not available.")}
      </div>
    );
  }

  const homeName = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const awayName = teamName(language, match.awayTeam.id, match.awayTeam.name);

  // Flatten for simple view if preferred, or group
  const allStats = statsGroups.flatMap((g: any) => g.items);

  // Filter out some key stats to show at top
  const keyStatNames = ["Ball Possession", "Total Shots", "Shots On Goal"];
  const possessionStat = allStats.find((s: any) => s.name.includes("Possession"));
  const otherStats = allStats.filter((s: any) => !s.name.includes("Possession"));

  return (
    <div className="space-y-6 pb-6">
      <div className="flex justify-between items-center px-4 mb-2">
        <span className="text-[10px] font-bold text-white/40 uppercase">{homeName}</span>
        <span className="text-[10px] font-bold text-white/40 uppercase">{awayName}</span>
      </div>

      {possessionStat && (
        <div className="px-2">
          <StatComparison stat={possessionStat} isHighlight={true} />
        </div>
      )}

      <div className="bg-[#07100c] border border-[#1a382d] rounded-[24px] p-4 space-y-5">
        {otherStats.slice(0, 10).map((stat: any, idx: number) => (
          <StatComparison key={idx} stat={stat} />
        ))}
      </div>
    </div>
  );
}

function StatComparison({ stat, isHighlight }: any) {
  // Attempt to parse values
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
        <span className={cn("text-[11px] font-bold text-white/50 uppercase tracking-wide", isHighlight && "text-[#10b981]")}>{stat.name}</span>
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
 * 4. COMMENTARY / TIMELINE VIEW
 * ========================================================================= */
function CommentaryView({ incidents, match, language, t }: any) {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#1a382d] p-12 text-center text-sm text-white/40">
        {t("No events recorded yet.", "No events recorded yet.")}
      </div>
    );
  }

  // Sort incidents by time descending
  const sorted = [...incidents].sort((a: any, b: any) => (b.time || 0) - (a.time || 0));

  return (
    <div className="relative py-4 pb-20">
      {/* Center Timeline line */}
      <div className="absolute left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-[#10b981]/50 via-[#10b981]/20 to-transparent -translate-x-1/2" />

      <div className="space-y-6">
        {sorted.map((inc: any, idx: number) => {
          const isHome = inc.isHome;
          
          if (inc.type === "period" || inc.type === "injury_time") {
             return (
               <div key={inc.id || idx} className="flex justify-center relative z-10 my-6">
                 <span className="bg-[#07100c] border border-[#1a382d] text-white/60 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                   {inc.detail || inc.type} {inc.time ? `${inc.time}'` : ''}
                 </span>
               </div>
             );
          }

          return (
            <div key={inc.id || idx} className={cn("flex w-full relative z-10", isHome ? "justify-start" : "justify-end")}>
              
              {/* Event Card */}
              <div className={cn("w-[calc(50%-20px)]", isHome ? "pr-4 text-right" : "pl-4 text-left")}>
                <div className={cn(
                  "inline-flex flex-col gap-1 rounded-2xl border border-white/5 bg-[#07100c]/80 backdrop-blur-md p-3 shadow-lg hover:border-white/10 transition-colors max-w-full",
                  isHome ? "items-end" : "items-start"
                )}>
                  
                  <div className={cn("flex items-center gap-2", isHome ? "flex-row-reverse" : "flex-row")}>
                     <IncidentIcon type={inc.type} cardType={inc.cardType} />
                     <span className="text-[13px] font-bold text-white truncate max-w-[120px]">
                       {inc.type === "substitution" ? inc.playerInName : (inc.playerName || "Unknown")}
                     </span>
                  </div>
                  
                  {inc.type === "substitution" && (
                    <div className={cn("flex items-center gap-1 text-[11px] text-white/40", isHome ? "flex-row-reverse" : "flex-row")}>
                       <span>Out:</span> <span>{inc.playerOutName}</span>
                    </div>
                  )}

                  {inc.score && inc.type === "goal" && (
                    <div className="mt-1 bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-[11px] font-bold px-2 py-0.5 rounded">
                      {inc.score.home} - {inc.score.away}
                    </div>
                  )}

                  {inc.detail && inc.type !== "substitution" && (
                     <span className="text-[10px] text-white/40 mt-0.5 block">{inc.detail}</span>
                  )}
                </div>
              </div>

              {/* Center Node */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                 <div className="w-8 h-8 rounded-full bg-[#050b09] border border-[#10b981]/30 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.2)] z-10">
                   <span className="text-[10px] font-black text-[#10b981]">{inc.time}'</span>
                 </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IncidentIcon({ type, cardType }: any) {
  if (type === "goal") return <span className="text-base drop-shadow-md">⚽</span>;
  if (type === "substitution") return <span className="text-base text-white/60">🔄</span>;
  if (type === "card") {
    if (cardType === "red") return <span className="w-3 h-4 rounded-sm bg-[#ef4444] border border-white/20 shadow-md inline-block"></span>;
    return <span className="w-3 h-4 rounded-sm bg-[#eab308] border border-white/20 shadow-md inline-block"></span>;
  }
  return <CircleDot size={14} className="text-white/40" />;
}

function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-32 rounded-[24px] bg-white/[.02]" />
      <div className="h-12 rounded-xl bg-white/[.02]" />
      <div className="h-64 rounded-[24px] bg-white/[.02]" />
    </div>
  );
}
