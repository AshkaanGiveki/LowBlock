"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, RotateCcw, FastForward, Tv, X } from "lucide-react";
import { TeamCrest } from "./TeamCrest";
import { cn } from "@/lib/utils";
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
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxMinute = Math.max(90, ...(incidents.map((i) => i.time + (i.addedTime || 0))));

  const sortedIncidents = [...incidents].sort((a, b) => {
    const timeDiff = a.time - b.time;
    if (timeDiff !== 0) return timeDiff;
    return (a.addedTime || 0) - (b.addedTime || 0);
  });

  const homeName = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const awayName = teamName(language, match.awayTeam.id, match.awayTeam.name);

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

        // Check for events at the next minute
        const nextMin = prev + 1;
        const eventsAtNextMin = sortedIncidents.filter((i) => i.time === nextMin && !i.addedTime);
        
        if (eventsAtNextMin.length > 0) {
          setIsPlaying(false); // Pause for event
          
          // Show the first event (if multiple, we could queue them, but for simplicity we take the most important or just the first)
          const importantEvent = eventsAtNextMin.find(e => e.type === "goal" || e.type === "var") || eventsAtNextMin[0];
          setActiveEvent(importantEvent);

          // Update score if the event has a score attached
          if (importantEvent.score) {
            setSimulatedScore(importantEvent.score);
          }

          // Resume after 3.5 seconds
          setTimeout(() => {
            setActiveEvent(null);
            setIsPlaying(true);
          }, 3500);
        }

        return nextMin;
      });
    }, 300); // 300ms per minute = ~27 seconds for 90 minutes

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, maxMinute, sortedIncidents]);

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentMinute(0);
    setSimulatedScore({ home: 0, away: 0 });
    setActiveEvent(null);
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
          {activeEvent ? (
            <EventOverlay 
              key={activeEvent.id} 
              event={activeEvent} 
              match={match} 
              language={language} 
              t={t} 
            />
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

  if (event.type === "goal") {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.5, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
        transition={{ type: "spring", damping: 15 }}
        className="text-center w-full px-6"
      >
        <motion.div 
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-7xl mb-4 drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]"
        >
          ⚽
        </motion.div>
        <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 rounded-full px-4 py-1.5 mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <span className="text-emerald-400 font-black text-sm uppercase tracking-widest">{t("گل", "GOAL!")}</span>
          <span className="text-white/60 text-xs">|</span>
          <TeamCrest name={teamTitle} logo={teamLogo} className="w-4 h-4" />
          <span className="text-white font-bold text-xs">{teamTitle}</span>
        </div>
        <h3 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight">{event.playerName || t("بازیکن", "Player")}</h3>
        {event.assistName && (
          <p className="text-white/50 text-sm font-bold uppercase tracking-wider">
            {t("پاس گل:", "Assist:")} <span className="text-emerald-400">{event.assistName}</span>
          </p>
        )}
      </motion.div>
    );
  }

  if (event.type === "card") {
    const isRed = event.cardType === "red" || event.cardType === "yellow_red";
    return (
      <motion.div 
        initial={{ opacity: 0, x: isHome ? -50 : 50, rotate: isHome ? -10 : 10 }}
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="flex flex-col items-center"
      >
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", bounce: 0.6 }}
          className={cn(
            "w-20 h-28 rounded-md mb-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border-2 border-white/20",
            isRed ? "bg-gradient-to-br from-red-500 to-red-700 shadow-[0_0_40px_rgba(239,68,68,0.5)]" : "bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_40px_rgba(245,158,11,0.5)]"
          )}
        />
        <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-1.5 mb-4">
          <TeamCrest name={teamTitle} logo={teamLogo} className="w-4 h-4" />
          <span className="text-white font-bold text-xs">{teamTitle}</span>
        </div>
        <h3 className="text-2xl font-black text-white text-center">{event.playerName}</h3>
        <p className={cn("text-sm font-bold mt-1 uppercase tracking-widest", isRed ? "text-red-400" : "text-amber-400")}>
          {isRed ? (language === "fa" ? "کارت قرمز" : "RED CARD") : (language === "fa" ? "کارت زرد" : "YELLOW CARD")}
        </p>
      </motion.div>
    );
  }

  if (event.type === "var") {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.2 }}
        className="flex flex-col items-center"
      >
        <div className="w-24 h-24 rounded-2xl bg-violet-600/20 border border-violet-500/50 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(139,92,246,0.4)]">
          <Tv className="text-violet-400" size={48} />
        </div>
        <h3 className="text-3xl font-black text-violet-300 mb-2 uppercase tracking-widest">VAR</h3>
        <p className="text-white/80 font-bold text-center max-w-[250px]">{event.detail || "Decision Review"}</p>
      </motion.div>
    );
  }

  if (event.type === "substitution") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-white/50 text-xs font-bold uppercase tracking-widest">{t("تعویض", "SUBSTITUTION")}</span>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <span className="text-emerald-400 text-lg font-black">↑</span>
            </div>
            <div className="flex-1">
              <span className="text-xs text-white/50 font-bold uppercase block mb-0.5">IN</span>
              <span className="text-white font-black text-lg">{event.playerInName}</span>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
              <span className="text-rose-400 text-lg font-black">↓</span>
            </div>
            <div className="flex-1">
              <span className="text-xs text-white/50 font-bold uppercase block mb-0.5">OUT</span>
              <span className="text-white/60 font-bold text-lg">{event.playerOutName}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Fallback for other events
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center"
    >
      <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-4">
        <TeamCrest name={teamTitle} logo={teamLogo} className="w-4 h-4" />
        <span className="text-white font-bold text-xs">{teamTitle}</span>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{event.playerName || event.detail}</h3>
      <p className="text-white/50 text-sm uppercase tracking-widest">{event.type}</p>
    </motion.div>
  );
}
