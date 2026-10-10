"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, RotateCcw, FastForward, Tv, X } from "lucide-react";
import { TeamCrest } from "./TeamCrest";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}
import { teamName } from "@/lib/football/team-names";
import { formatNumber } from "@/lib/text";

type ReplayProps = {
  match: any;
  incidents: any[];
  language: "fa" | "en";
  t: (fa: string, en: string) => string;
};

export function MatchReplay({ match, incidents, language, t }: ReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [simulatedScore, setSimulatedScore] = useState({ home: 0, away: 0 });
  const [activeEvents, setActiveEvents] = useState<any[] | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxMinute = Math.max(90, ...(incidents.map((i) => i.time))); // Ignore addedTime for max duration

  const sortedIncidents = [...incidents].sort((a, b) => {
    const timeDiff = a.time - b.time;
    if (timeDiff !== 0) return timeDiff;
    return (a.addedTime || 0) - (b.addedTime || 0);
  });

  const homeName = teamName(language, match.homeTeam.id, match.homeTeam.name, undefined, match.homeTeam.faName);
  const awayName = teamName(language, match.awayTeam.id, match.awayTeam.name, undefined, match.awayTeam.faName);

  // Playback Logic
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentMinute((prev) => {
        if (prev >= maxMinute) {
          setIsPlaying(false);
          return prev;
        }

        const nextMin = prev + 1;
        const eventsAtNextMin = sortedIncidents.filter((i) => i.time === nextMin);
        
        if (eventsAtNextMin.length > 0) {
          setIsPlaying(false); // Pause for event
          
          setActiveEvents(eventsAtNextMin);

          // Update score if any event has a score attached
          const scoreEvent = [...eventsAtNextMin].reverse().find(e => e.score);
          if (scoreEvent) {
            setSimulatedScore(scoreEvent.score);
          }

          // Resume after a delay based on the number of events
          const delay = eventsAtNextMin.some(e => e.type === "goal" || e.type === "var") ? 3500 : 2500;
          setTimeout(() => {
            setActiveEvents(null);
            setIsPlaying(true);
          }, delay);
        }

        return nextMin;
      });
    }, 300);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, maxMinute, sortedIncidents]);

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentMinute(0);
    setSimulatedScore({ home: 0, away: 0 });
    setActiveEvents(null);
    setTimeout(() => setIsPlaying(true), 500);
  };

  const n = (val: number) => formatNumber(val, language);

  return (
    <div className="relative w-full h-[500px] bg-gradient-to-b from-[#020604] to-[#07130c] rounded-[24px] border border-[#10b981]/20 overflow-hidden shadow-2xl flex flex-col">
      {/* Top Scoreboard */}
      <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <TeamCrest name={match.homeTeam.name} logo={match.homeTeam.logoUrl} className="w-8 h-8" />
          <span className="text-white font-black text-sm hidden sm:block">{homeName}</span>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-black text-[#10b981] mb-1 px-2 py-0.5 rounded border border-[#10b981]/30 bg-[#10b981]/10">
            {n(currentMinute)}'
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-widest drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
            {n(simulatedScore.home)} - {n(simulatedScore.away)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-white font-black text-sm hidden sm:block text-right">{awayName}</span>
          <TeamCrest name={match.awayTeam.name} logo={match.awayTeam.logoUrl} className="w-8 h-8" />
        </div>
      </div>

      {/* Main Display Area */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Pitch Background faint */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/grass.png')] mix-blend-overlay" />
        
        <AnimatePresence mode="wait">
          {activeEvents && activeEvents.length > 0 ? (
            <motion.div
              key="events-container"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col gap-4 items-center justify-center w-full max-w-md max-h-full overflow-y-auto no-scrollbar"
            >
              {activeEvents.map(ev => (
                <EventOverlay 
                  key={ev.id} 
                  event={ev} 
                  match={match} 
                  language={language} 
                  t={t} 
                />
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="playing-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center text-white/30"
            >
              {!isPlaying && currentMinute === 0 && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-[#10b981]/20 flex items-center justify-center mx-auto mb-4 border border-[#10b981]/40 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <Play className="text-[#10b981] ml-1" size={32} />
                  </div>
                  <p className="text-sm font-bold text-white/80">{t("آماده برای شبیه‌سازی", "Ready for Simulation")}</p>
                </div>
              )}
              {currentMinute >= maxMinute && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <RotateCcw className="text-white/60" size={32} />
                  </div>
                  <p className="text-sm font-bold text-white/80">{t("پایان مسابقه", "Full Time")}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Footer */}
      <div className="p-4 border-t border-white/5 bg-black/40 flex items-center justify-between z-10">
        <button 
          onClick={handleRestart}
          className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
        >
          <RotateCcw size={18} />
        </button>
        
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={currentMinute >= maxMinute}
          className="w-14 h-14 rounded-full bg-[#10b981] flex items-center justify-center text-black hover:bg-[#059669] transition-colors shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50"
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
        </button>

        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/60">
          <FastForward size={18} />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5">
        <motion.div 
          className="h-full bg-gradient-to-r from-[#10b981] to-[#34d399]"
          style={{ width: `${Math.min(100, (currentMinute / maxMinute) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function EventOverlay({ event, match, language, t }: { event: any, match: any, language: string, t: any }) {
  const isHome = event.isHome;
  const teamTitle = isHome ? match.homeTeam.name : match.awayTeam.name;
  const teamLogo = isHome ? match.homeTeam.logoUrl : match.awayTeam.logoUrl;

  if (event.type === "period") {
    let label = event.detail;
    const d = String(event.detail || "").toLowerCase();
    if (d.includes("ft") || d.includes("ended") || d.includes("full time")) {
      label = language === "fa" ? "پایان بازی" : "Full Time";
    } else if (d.includes("ht") || d.includes("halftime") || d.includes("half time")) {
      label = language === "fa" ? "پایان نیمه اول" : "Half Time";
    }
    return (
      <div className="text-center w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
        <h3 className="text-3xl font-black text-white uppercase tracking-widest">{label}</h3>
      </div>
    );
  }

  if (event.type === "goal") {
    return (
      <div className="text-center w-full px-6 py-4">
        <motion.div 
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-6xl mb-3 drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]"
        >
          ⚽
        </motion.div>
        <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 rounded-full px-4 py-1.5 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <span className="text-emerald-400 font-black text-sm uppercase tracking-widest">{t("گل", "GOAL!")}</span>
          <span className="text-white/60 text-xs">|</span>
          <TeamCrest name={teamTitle} logo={teamLogo} className="w-4 h-4" />
          <span className="text-white font-bold text-xs">{teamTitle}</span>
        </div>
        <div className="flex items-center justify-center gap-3">
          {event.playerImage && (
            <img src={event.playerImage} className="w-12 h-12 rounded-full border-2 border-emerald-500 bg-black/40 object-cover" />
          )}
          <div className="text-left">
            <h3 className="text-3xl font-black text-white tracking-tight">{event.playerName || t("بازیکن", "Player")}</h3>
            {event.assistName && (
              <p className="text-white/50 text-sm font-bold uppercase tracking-wider">
                {t("پاس گل:", "Assist:")} <span className="text-emerald-400">{event.assistName}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (event.type === "card") {
    const isRed = event.cardType === "red" || event.cardType === "yellow_red";
    return (
      <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl p-4 w-full">
        <div className={cn(
          "w-10 h-14 rounded-sm shadow-[0_5px_15px_rgba(0,0,0,0.5)] border border-white/20 flex-shrink-0",
          isRed ? "bg-gradient-to-br from-red-500 to-red-700 shadow-[0_0_20px_rgba(239,68,68,0.3)]" : "bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
        )} />
        <div className="flex-1 text-left">
          <div className="flex items-center gap-1.5 mb-1">
            <TeamCrest name={teamTitle} logo={teamLogo} className="w-3.5 h-3.5" />
            <span className="text-white/50 text-[10px] font-bold">{teamTitle}</span>
          </div>
          <h3 className="text-xl font-black text-white">{event.playerName}</h3>
          <p className={cn("text-xs font-bold uppercase tracking-widest", isRed ? "text-red-400" : "text-amber-400")}>
            {isRed ? (language === "fa" ? "کارت قرمز" : "RED CARD") : (language === "fa" ? "کارت زرد" : "YELLOW CARD")}
          </p>
        </div>
      </div>
    );
  }

  if (event.type === "var") {
    return (
      <div className="flex flex-col items-center p-4 bg-violet-900/20 border border-violet-500/30 rounded-2xl w-full">
        <div className="flex items-center gap-2 mb-2">
          <Tv className="text-violet-400" size={24} />
          <h3 className="text-xl font-black text-violet-300 uppercase tracking-widest">VAR</h3>
        </div>
        <p className="text-white/80 font-bold text-center text-sm">{event.detail || "Decision Review"}</p>
      </div>
    );
  }

  if (event.type === "substitution") {
    return (
      <div className="bg-black/60 border border-white/10 rounded-2xl p-3 w-full flex items-center justify-between">
        <div className="flex items-center gap-3 w-[45%]">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-400 text-xs font-black">↑</span>
          </div>
          <div className="min-w-0">
            <span className="text-[9px] text-emerald-400 font-bold uppercase block leading-none">IN</span>
            <span className="text-white font-bold text-sm truncate block">{event.playerInName}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center px-2">
          <TeamCrest name={teamTitle} logo={teamLogo} className="w-5 h-5 mb-1" />
          <span className="text-[8px] text-white/30 font-mono tracking-widest">SUB</span>
        </div>

        <div className="flex items-center justify-end gap-3 w-[45%] text-right">
          <div className="min-w-0">
            <span className="text-[9px] text-rose-400 font-bold uppercase block leading-none">OUT</span>
            <span className="text-white/60 font-bold text-sm truncate block">{event.playerOutName}</span>
          </div>
          <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-rose-400 text-xs font-black">↓</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10 w-full">
      <div className="inline-flex items-center gap-1.5 mb-2">
        <TeamCrest name={teamTitle} logo={teamLogo} className="w-4 h-4" />
        <span className="text-white/60 font-bold text-[10px]">{teamTitle}</span>
      </div>
      <h3 className="text-lg font-bold text-white leading-tight">{event.playerName || event.detail}</h3>
      <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">{event.type}</p>
    </div>
  );
}
