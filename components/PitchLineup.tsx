"use client";

import { useMemo, useState } from "react";
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

      {/* Pitch Area */}
      <div className="relative w-full aspect-[4/5] bg-[#3e7d56] rounded-xl overflow-hidden border-2 border-white/20 shadow-inner">
        {/* Pitch Lines */}
        <div className="absolute inset-2 border-2 border-white/30 rounded-sm pointer-events-none" />
        <div className="absolute top-1/2 left-2 right-2 h-0 border-t-2 border-white/30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 border-2 border-white/30 rounded-full pointer-events-none" />
        
        {/* Penalty Areas */}
        <div className="absolute bottom-2 left-1/2 w-1/2 h-[15%] -translate-x-1/2 border-2 border-white/30 border-b-0 pointer-events-none" />
        <div className="absolute bottom-2 left-1/2 w-1/4 h-[6%] -translate-x-1/2 border-2 border-white/30 border-b-0 pointer-events-none" />
        <div className="absolute top-2 left-1/2 w-1/2 h-[15%] -translate-x-1/2 border-2 border-white/30 border-t-0 pointer-events-none" />
        <div className="absolute top-2 left-1/2 w-1/4 h-[6%] -translate-x-1/2 border-2 border-white/30 border-t-0 pointer-events-none" />

        {/* Players */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col justify-between py-6"
          >
            {renderPitchRows(currentTeam, isHome, incidents, language)}
          </motion.div>
        </AnimatePresence>
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

  const maxWidth = rowCount <= 3 ? "max-w-[100px]" : rowCount <= 4 ? "max-w-[85px]" : "max-w-[65px]";

  return (
    <div className="flex flex-col items-center relative">
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
        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 z-20 w-4 h-4 bg-white rounded-full flex items-center justify-center border-[1.5px] border-[#3e7d56] shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
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

      {/* Player Avatar */}
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#112a1e] border-[1.5px] border-white/40 flex items-center justify-center overflow-hidden shadow-[0_4px_10px_rgba(0,0,0,0.5)] mb-1 relative z-10">
        {player.id && String(player.id) !== "0" ? (
          <img 
            src={`/api/player-image/${player.id}`} 
            alt={player.shortName || player.name}
            className="w-full h-full object-cover object-top"
            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-xs font-bold text-gray-400">{player.number || "?"}</span>
        )}
      </div>
      
      {/* Player Name */}
      <div className={cn("text-white text-[9px] md:text-[10px] font-bold px-1 text-center truncate drop-shadow-[0_2px_3px_rgba(0,0,0,1)] z-10", maxWidth)}>
        {player.number && <span className="text-white/70 mr-1">{player.number}</span>}
        {player.shortName || player.name}
      </div>
    </div>
  );
}
