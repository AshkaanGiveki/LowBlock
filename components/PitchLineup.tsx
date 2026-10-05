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

      {/* Perspective pitch */}
      <div className="relative isolate w-full overflow-hidden rounded-[28px] border border-[#b7ff4d]/20 bg-[#020504] p-2 shadow-[0_25px_80px_rgba(0,0,0,0.5)] sm:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(183,255,77,0.12),transparent_48%),linear-gradient(180deg,#07100c,#010202)]" />
        <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-[#020504] [perspective:1000px]">
          <div className="absolute inset-0 origin-bottom [transform:rotateX(8deg)] [clip-path:polygon(12%_2%,88%_2%,100%_98%,0_98%)] bg-[#030806] shadow-[inset_0_0_70px_rgba(0,0,0,0.9),0_0_40px_rgba(183,255,77,0.08)]">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(105deg,transparent_0%,rgba(183,255,77,0.04)_48%,transparent_100%),repeating-linear-gradient(90deg,rgba(255,255,255,0.018)_0,rgba(255,255,255,0.018)_1px,transparent_1px,transparent_18px)]" />
            <div className="absolute inset-[3%_5%] border border-white/55" />
            <div className="absolute inset-x-[5%] top-1/2 border-t border-white/45" />
            <div className="absolute left-1/2 top-1/2 h-[17%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#b7ff4d]/70 shadow-[0_0_18px_rgba(183,255,77,0.14)]" />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b7ff4d] shadow-[0_0_12px_#b7ff4d]" />
            <div className="absolute inset-x-[28%] bottom-[3%] h-[18%] border border-white/55 border-b-0" />
            <div className="absolute inset-x-[39%] bottom-[3%] h-[8%] border border-[#b7ff4d]/70 border-b-0" />
            <div className="absolute inset-x-[28%] top-[3%] h-[18%] border border-white/55 border-t-0" />
            <div className="absolute inset-x-[39%] top-[3%] h-[8%] border border-[#b7ff4d]/70 border-t-0" />
            <div className="absolute left-1/2 bottom-[3%] h-1 w-14 -translate-x-1/2 rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.4)]" />
            <div className="absolute left-1/2 top-[3%] h-1 w-14 -translate-x-1/2 rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.4)]" />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSide}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-[7%_8%] flex flex-col justify-between py-3 sm:inset-[7%_9%] sm:py-5"
              >
                {renderPitchRows(currentTeam, isHome, incidents, language)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.35em] text-white/25">{isHome ? "Home shape" : "Away shape"}</div>
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
    <div key={rowIndex} className="flex justify-evenly items-center w-full px-2 md:px-4">
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

  const maxWidth = rowCount <= 3 ? "max-w-[112px]" : rowCount <= 4 ? "max-w-[96px]" : "max-w-[76px]";

  return (
    <div className="group relative flex flex-col items-center">
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
        "relative z-10 flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] border-2 bg-[#07100c] shadow-[0_7px_16px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:-translate-y-1 sm:h-12 sm:w-12",
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
        "relative z-10 mt-1 rounded-lg border bg-[#050907]/90 px-1.5 py-1 text-center shadow-[0_5px_12px_rgba(0,0,0,0.5)] backdrop-blur-sm",
        maxWidth,
        isHome ? "border-[#b7ff4d]/35" : "border-white/25"
      )}>
        <div className="truncate text-[9px] font-black leading-tight text-white sm:text-[10px]">{player.shortName || player.name}</div>
        {player.position && <div className={cn("mt-0.5 text-[7px] font-bold uppercase tracking-wider", isHome ? "text-[#b7ff4d]/75" : "text-white/50")}>{player.position}</div>}
      </div>
    </div>
  );
}
