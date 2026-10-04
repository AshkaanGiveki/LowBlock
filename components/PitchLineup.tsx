"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { TeamCrest } from "./TeamCrest";

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
          <div className="flex flex-wrap gap-2">
            {currentTeam.substitutes.map((sub: Player) => (
              <div key={sub.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <span className="text-[10px] font-mono text-white/40 w-4 text-center">{sub.number}</span>
                <span className="text-xs font-medium text-white/80">{sub.shortName || sub.name}</span>
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

  // If it's the away team, they defend the top, so GK is at the top.
  // Home team defends the bottom, so GK is at the bottom.
  // We want to reverse the rows for home team so GK is at bottom.
  // Actually, usually in standard pitch view, your team's GK is at bottom.
  const displayRows = [...rows].reverse(); 

  return displayRows.map((rowPlayers, rowIndex) => (
    <div key={rowIndex} className="flex justify-evenly items-center w-full px-4">
      {rowPlayers.map((player: Player) => (
        <PitchPlayer 
          key={player.id} 
          player={player} 
          isHome={isHome} 
          incidents={incidents} 
          language={language}
        />
      ))}
    </div>
  ));
}

function PitchPlayer({ player, isHome, incidents, language }: { player: Player, isHome: boolean, incidents: any[], language: string }) {
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

  return (
    <div className="flex flex-col items-center relative">
      {/* Event Icons */}
      <div className="absolute -top-3 -right-3 flex gap-0.5 z-10">
        {goals.map((_, i) => (
          <span key={`goal-${i}`} className="text-[12px] bg-black/50 rounded-full leading-none drop-shadow-md">⚽</span>
        ))}
        {cards.map((c, i) => (
          <span key={`card-${i}`} className={cn("w-2 h-3 rounded-[1px] border border-white/50 shadow-md", c.cardType === "red" ? "bg-red-500" : "bg-amber-400")} />
        ))}
      </div>
      
      {/* Sub Icon */}
      {(isSubIn || isSubOut) && (
        <div className="absolute -bottom-1 -right-2 bg-black/60 border border-white/20 rounded-full p-0.5 z-10">
          <span className={cn("text-[8px] font-bold", isSubIn ? "text-emerald-400" : "text-rose-400")}>
            {isSubIn ? "↑" : "↓"}
          </span>
        </div>
      )}

      {/* Player Avatar */}
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white border-2 border-[#3e7d56] flex items-center justify-center overflow-hidden shadow-lg mb-1 relative">
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
        
        {/* Rating Bubble (Placeholder for now as rating isn't in DB yet, but design requires it) */}
        {/*
        <div className="absolute bottom-0 bg-orange-500 text-white text-[8px] font-bold px-1 rounded-sm border border-white/20">
          6.5
        </div>
        */}
      </div>
      
      {/* Player Name */}
      <div className="bg-black/50 backdrop-blur-sm rounded text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 text-center max-w-[60px] md:max-w-[80px] truncate shadow-sm border border-white/10">
        {player.number && <span className="text-white/50 mr-1">{player.number}</span>}
        {player.shortName || player.name}
      </div>
    </div>
  );
}
