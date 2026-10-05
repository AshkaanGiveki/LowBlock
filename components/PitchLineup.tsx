"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TeamCrest } from "./TeamCrest";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type Player = {
  id: number;
  name: string;
  shortName?: string;
  number?: string | number;
  position?: string;
};

type LineupProps = {
  lineups: any;
  match: any;
  language: "fa" | "en";
  t: (fa: string, en: string) => string;
  incidents: any[];
};

export function PitchLineup({ lineups, match, language, t, incidents }: LineupProps) {
  const [activeSide, setActiveSide] = useState<"home" | "away">("home");

  if (!lineups || (!lineups.home?.players?.length && !lineups.away?.players?.length)) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#1a382d] p-12 text-center text-sm text-white/40">
        {t("ترکیب این مسابقه هنوز اعلام نشده است.", "Lineups are not available yet.")}
      </div>
    );
  }

  const currentTeam = activeSide === "home" ? lineups.home : lineups.away;
  const isHome = activeSide === "home";

  return (
    <div className="space-y-4">
      {/* Team Tabs */}
      <div className="flex rounded-xl bg-black/40 p-1 border border-white/5 mb-2">
        <button
          type="button"
          onClick={() => setActiveSide("home")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            activeSide === "home"
              ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 shadow-sm"
              : "text-white/40 hover:text-white"
          )}
        >
          <TeamCrest name={match.homeTeam.name} logo={match.homeTeam.logoUrl || match.homeTeam.logo} className="h-5 w-5 object-contain" />
          {match.homeTeam.name}
        </button>
        <button
          type="button"
          onClick={() => setActiveSide("away")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            activeSide === "away"
              ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 shadow-sm"
              : "text-white/40 hover:text-white"
          )}
        >
          <TeamCrest name={match.awayTeam.name} logo={match.awayTeam.logoUrl || match.awayTeam.logo} className="h-5 w-5 object-contain" />
          {match.awayTeam.name}
        </button>
      </div>

      {/* Generated transparent pitch + deliberately separated formation lanes */}
      <div className="relative isolate w-full overflow-hidden rounded-[30px] border border-white/10 bg-[#050807] px-1 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.58)] sm:px-3 sm:py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,rgba(183,255,77,0.08),transparent_58%)]" />
        <div className="relative aspect-[4/5] w-full">
          <img
            src="/images/pitch-field-v2.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSide}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-[10%_8%_11%] flex flex-col justify-between py-1 sm:inset-[10%_9%_11%] sm:py-2"
            >
              {renderPitchRows(currentTeam, isHome, incidents, language)}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.35em] text-white/30">{isHome ? "Home formation" : "Away formation"}</div>
      </div>

      {/* Substitutes */}
      {currentTeam?.substitutes?.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wider px-2">
            {t("نیمکت‌نشینان", "Substitutes")}
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-4 pb-2 px-2">
            {currentTeam.substitutes.map((sub: Player) => (
              <div key={sub.id} className="flex flex-col items-center flex-shrink-0 w-12">
                <div className="w-10 h-10 rounded-full bg-[#112a1e] border border-white/20 flex items-center justify-center overflow-hidden shadow-sm mb-1 relative">
                  {sub.id && String(sub.id) !== "0" ? (
                    <img
                      src={`/api/player-image/${sub.id}`}
                      alt={sub.shortName || sub.name}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-white/40">{sub.number || "?"}</span>
                  )}
                </div>
                <div className="text-center text-[9px] font-bold text-white/90 w-full truncate drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  {sub.shortName || sub.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderPitchRows(team: any, isHome: boolean, incidents: any[], language: string) {
  const formation = team.formation || "4-3-3";
  // "4-2-3-1" -> [1, 4, 2, 3, 1] (we add 1 for GK at the start)
  const numbers = [1, ...formation.split("-").map(Number)];
  const players = team.players || [];
  
  // We slice players into rows. 
  const rows = [];
  let currentIndex = 0;
  for (let count of numbers) {
    if (currentIndex >= players.length) break;
    rows.push(players.slice(currentIndex, currentIndex + count));
    currentIndex += count;
  }

  const displayRows = [...rows].reverse(); 

  return displayRows.map((rowPlayers, rowIndex) => (
    <div key={rowIndex} className="flex w-full items-center justify-center gap-2 px-1 sm:gap-4 sm:px-3">
      {rowPlayers.map((player: Player) => (
        <PitchPlayer 
          key={player.id} 
          player={player} 
          isHome={isHome} 
          incidents={incidents} 
          language={language}
          rowCount={rowPlayers.length}
        />
      ))}
    </div>
  ));
}

function PitchPlayer({ player, isHome, incidents, language, rowCount }: { player: Player, isHome: boolean, incidents: any[], language: string, rowCount: number }) {
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

  const goals = pIncidents.filter((i) => i.type === "goal");
  const cards = pIncidents.filter((i) => i.type === "card");
  const isSubIn = pIncidents.some((i) => i.type === "substitution" && (i.playerInName === player.name || i.playerInName === player.shortName));
  const isSubOut = pIncidents.some((i) => i.type === "substitution" && (i.playerOutName === player.name || i.playerOutName === player.shortName));

  const cardWidth = rowCount <= 2 ? "w-[82px] sm:w-[100px]" : rowCount <= 3 ? "w-[68px] sm:w-[86px]" : rowCount <= 4 ? "w-[58px] sm:w-[74px]" : "w-[49px] sm:w-[64px]";

  return (
    <div className={cn("group relative flex shrink-0 flex-col items-center", cardWidth)}>
      {/* Top Right: Goals/Assists/Pens */}
      {goals.length > 0 && (
        <div className="absolute -top-1.5 -right-1.5 flex flex-row-reverse gap-[-4px] z-20">
          {goals.map((_, i) => (
            <span key={`goal-${i}`} className="text-[14px] drop-shadow-[0_2px_2px_rgba(0,0,0,1)] -ml-1.5">⚽</span>
          ))}
        </div>
      )}

      {/* Left: Subs */}
      {(isSubIn || isSubOut) && (
        <div className="absolute top-1/2 -left-1.5 z-20 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-[#b7ff4d]/50 bg-[#050907] shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
          <span className={cn("text-[9px] font-black leading-none", isSubIn ? "text-emerald-600" : "text-rose-600")}>
            {isSubIn ? "⬆" : "⬇"}
          </span>
        </div>
      )}

      {/* Bottom Right: Cards */}
      {cards.length > 0 && (
        <div className="absolute -bottom-0.5 -right-1 flex gap-0.5 z-20">
          {cards.map((c, i) => (
            <span key={`card-${i}`} className={cn("w-2.5 h-3.5 rounded-[2px] border border-white/70 shadow-[0_2px_4px_rgba(0,0,0,0.8)]", c.cardType === "red" ? "bg-red-500" : "bg-amber-400")} />
          ))}
        </div>
      )}

      {/* Player card */}
      <div className={cn(
        "relative z-10 flex h-8 w-8 items-center justify-center overflow-hidden rounded-[11px] border-2 bg-[#07100c] shadow-[0_7px_16px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:-translate-y-1 sm:h-10 sm:w-10 sm:rounded-[13px]",
        isHome ? "border-[#b7ff4d]/80 shadow-[0_0_16px_rgba(183,255,77,0.22)]" : "border-white/70 shadow-[0_0_16px_rgba(255,255,255,0.14)]"
      )}>
        <div className={cn("absolute inset-x-0 bottom-0 h-1/2 opacity-80", isHome ? "bg-[#b7ff4d]/15" : "bg-white/10")} />
        {player.id && String(player.id) !== "0" ? (
          <img 
            src={`/api/player-image/${player.id}`} 
            alt={player.shortName || player.name}
            className="w-full h-full object-cover object-top"
            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
          />
        ) : (
          <span className={cn("text-sm font-black", isHome ? "text-[#b7ff4d]" : "text-white/80")}>{player.number || "?"}</span>
        )}
        {player.number && <span className="absolute bottom-0.5 right-1 text-[8px] font-black text-white/70">{player.number}</span>}
      </div>
      
      {/* Player label */}
      <div className={cn(
        "relative z-10 mt-1 w-full min-w-0 rounded-lg border bg-[#050907]/95 px-1 py-1 text-center shadow-[0_5px_12px_rgba(0,0,0,0.5)] backdrop-blur-sm",
        isHome ? "border-[#b7ff4d]/35" : "border-white/25"
      )}>
        <div className="truncate text-[8px] font-black leading-tight text-white sm:text-[9px]">{player.shortName || player.name}</div>
        {player.position && <div className={cn("mt-0.5 truncate text-[6px] font-bold uppercase tracking-wider", isHome ? "text-[#b7ff4d]/75" : "text-white/50")}>{player.position}</div>}
      </div>
    </div>
  );
}
