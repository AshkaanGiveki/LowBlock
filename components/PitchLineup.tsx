"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { TeamCrest } from "./TeamCrest";

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

type TeamColors = {
  primary: string;
  secondary: string;
  text: string;
};

const FALLBACK_HOME_COLORS: TeamColors = { primary: "#10b981", secondary: "#064e3b", text: "#ffffff" };
const FALLBACK_AWAY_COLORS: TeamColors = { primary: "#e7f4ee", secondary: "#64748b", text: "#07100c" };

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

function getTeamColors(team: any, isHome: boolean): TeamColors {
  const raw = team?.teamColors || team?.colors || {};
  const fallback = isHome ? FALLBACK_HOME_COLORS : FALLBACK_AWAY_COLORS;
  return {
    primary: safeColor(raw.primary, fallback.primary),
    secondary: safeColor(raw.secondary, fallback.secondary),
    text: safeColor(raw.text, fallback.text),
  };
}

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
    return <div className="rounded-[24px] border border-dashed border-[#1a382d] p-12 text-center text-sm text-white/40">{t("Lineups are not available yet.", "Lineups are not available yet.")}</div>;
  }

  const currentTeam = activeSide === "home" ? lineups.home : lineups.away;
  const isHome = activeSide === "home";

  return (
    <div className="space-y-4">
      <div className="mb-2 flex rounded-xl border border-white/5 bg-black/40 p-1">
        <TeamTab active={isHome} onClick={() => setActiveSide("home")} crest={<TeamCrest name={match.homeTeam.name} logo={match.homeTeam.logoUrl || match.homeTeam.logo} className="h-5 w-5 object-contain" />} name={match.homeTeam.name} />
        <TeamTab active={!isHome} onClick={() => setActiveSide("away")} crest={<TeamCrest name={match.awayTeam.name} logo={match.awayTeam.logoUrl || match.awayTeam.logo} className="h-5 w-5 object-contain" />} name={match.awayTeam.name} />
      </div>

      <div className="relative isolate w-full overflow-hidden rounded-[30px] border border-white/10 bg-[#050807] px-1 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.58)] sm:px-3 sm:py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,rgba(183,255,77,0.08),transparent_58%)]" />
        <div className="relative aspect-[4/5] w-full">
          <img src="/images/pitch-field-v2.png" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
          <AnimatePresence mode="wait">
            <motion.div key={activeSide} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="absolute inset-[10%_8%_17%] flex flex-col justify-between py-1 sm:inset-[10%_9%_16%] sm:py-2">
              {renderPitchRows(currentTeam, isHome, incidents, language, getTeamColors(isHome ? match.homeTeam : match.awayTeam, isHome))}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.35em] text-white/30">{isHome ? "Home formation" : "Away formation"}</div>
      </div>

      {currentTeam?.substitutes?.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-white/50">{t("Substitutes", "Substitutes")}</div>
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-2 pb-2">
            {currentTeam.substitutes.map((sub: Player) => (
              <div key={sub.id} className="flex w-12 shrink-0 flex-col items-center">
                <div className="relative mb-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-[#112a1e] shadow-sm">
                  {sub.id && String(sub.id) !== "0" ? <img src={`/api/player-image/${sub.id}`} alt={sub.shortName || sub.name} className="h-full w-full object-cover object-top" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span className="text-[10px] font-bold text-white/40">{sub.number || "?"}</span>}
                </div>
                <div className="w-full truncate text-center text-[9px] font-bold text-white/90">{sub.shortName || sub.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamTab({ active, onClick, crest, name }: { active: boolean; onClick: () => void; crest: React.ReactNode; name: string }) {
  return <button type="button" onClick={onClick} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all", active ? "border border-[#10b981]/30 bg-[#10b981]/20 text-[#10b981] shadow-sm" : "text-white/40 hover:text-white")}>{crest}{name}</button>;
}

function renderPitchRows(team: any, isHome: boolean, incidents: any[], language: string, teamColors: TeamColors) {
  const formation = team.formation || "4-3-3";
  const numbers = [1, ...formation.split("-").map(Number)];
  const players = team.players || [];
  const rows = [];
  let currentIndex = 0;
  for (const count of numbers) {
    if (currentIndex >= players.length) break;
    rows.push(players.slice(currentIndex, currentIndex + count));
    currentIndex += count;
  }

  return [...rows].reverse().map((rowPlayers, rowIndex) => (
    <div key={rowIndex} className="flex w-full items-center justify-center gap-2 px-1 sm:gap-4 sm:px-3">
      {rowPlayers.map((player: Player) => <PitchPlayer key={player.id} player={player} isHome={isHome} incidents={incidents} language={language} rowCount={rowPlayers.length} teamColors={teamColors} />)}
    </div>
  ));
}

type IncidentKind = "goal" | "assist" | "own_goal" | "penalty_miss" | "substitution" | "var" | "injury" | "other";

function getIncidentKind(incident: any): IncidentKind {
  const text = `${incident?.type || ""} ${incident?.detail || ""} ${incident?.incidentClass || ""}`.toLowerCase();
  if (text.includes("own") && text.includes("goal")) return "own_goal";
  if ((text.includes("penalty") || text.includes("pen")) && (text.includes("miss") || text.includes("fail"))) return "penalty_miss";
  if (text.includes("assist")) return "assist";
  if (text.includes("substitution") || text.includes("sub")) return "substitution";
  if (text.includes("var")) return "var";
  if (text.includes("injury")) return "injury";
  if (text.includes("goal")) return "goal";
  return "other";
}

function IncidentIcon({ kind, direction }: { kind: IncidentKind; direction?: "in" | "out" }) {
  const color = kind === "goal" ? "#b7ff4d" : kind === "assist" ? "#7dd3fc" : kind === "own_goal" ? "#fcd34d" : kind === "penalty_miss" ? "#fda4af" : kind === "substitution" ? "#6ee7b7" : kind === "var" ? "#93c5fd" : "#d1d5db";
  const label = kind.replace("_", " ");
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}>
      <title>{label}</title>
      {kind === "goal" && <><path d="M5 8.5 8 5h8l3 3.5v8L16 20H8l-3-3.5z" /><path d="m8 5 4 3 4-3M5 8.5l7-.5 7 .5M8 20l4-5 4 5M12 8v7" /></>}
      {kind === "assist" && <><circle cx="7" cy="12" r="2.5" /><circle cx="17" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /><path d="m9.2 11 5.4-3M9.2 13l5.4 3" /><path d="m17 4.5 2-2M19 21.5l-2-2" /></>}
      {kind === "own_goal" && <><path d="M5 6h14M7 6v12h10V6M9 18l3-4 3 4" /><path d="M12 3v7M9.5 7.5 12 10l2.5-2.5" /></>}
      {kind === "penalty_miss" && <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="m7 7 10 10M17 7 7 17" /></>}
      {kind === "substitution" && <>{direction === "out" ? <><path d="M5 8h12" /><path d="m14 5 3 3-3 3" /><path d="M19 16H7" /><path d="m10 13-3 3 3 3" /></> : <><path d="M5 16h12" /><path d="m14 13 3 3-3 3" /><path d="M19 8H7" /><path d="m10 5-3 3 3 3" /></>}</>}
      {kind === "var" && <><rect x="4" y="5" width="16" height="13" rx="2" /><path d="M8 21h8M12 18v3M8 9h8M8 12h5" /></>}
      {kind === "injury" && <><path d="M7 5h10v14H7z" /><path d="M10 9h4M12 7v4M9 15h6" /></>}
      {kind === "other" && <><path d="m12 3 8 9-8 9-8-9z" /><circle cx="12" cy="12" r="1" /></>}
    </svg>
  );
}

function PitchPlayer({ player, isHome, incidents, language, rowCount, teamColors }: { player: Player; isHome: boolean; incidents: any[]; language: string; rowCount: number; teamColors: TeamColors }) {
  const playerIncidents = incidents.filter((incident: any) => incident.isHome === isHome && (incident.playerName === player.name || incident.playerName === player.shortName || incident.playerInName === player.name || incident.playerInName === player.shortName || incident.playerOutName === player.name || incident.playerOutName === player.shortName || incident.assistName === player.name || incident.assistName === player.shortName));
  const goals = playerIncidents.filter((incident: any) => incident.type === "goal");
  const cards = playerIncidents.filter((incident: any) => incident.type === "card");
  const isSubIn = playerIncidents.some((incident: any) => incident.type === "substitution" && (incident.playerInName === player.name || incident.playerInName === player.shortName));
  const isSubOut = playerIncidents.some((incident: any) => incident.type === "substitution" && (incident.playerOutName === player.name || incident.playerOutName === player.shortName));
  const incidentKinds = playerIncidents.flatMap((incident: any) => {
    const kinds: IncidentKind[] = [];
    if (incident.assistName === player.name || incident.assistName === player.shortName) kinds.push("assist");
    if (incident.type !== "card") kinds.push(getIncidentKind(incident));
    return kinds;
  }).filter((kind, index, list) => list.indexOf(kind) === index).slice(0, 3);
  const cardWidth = rowCount <= 2 ? "w-[82px] sm:w-[100px]" : rowCount <= 3 ? "w-[68px] sm:w-[86px]" : rowCount <= 4 ? "w-[58px] sm:w-[74px]" : "w-[49px] sm:w-[64px]";

  return (
    <div className={cn("group relative flex shrink-0 flex-col items-center", cardWidth)}>
      {incidentKinds.length > 0 && <div className="absolute -right-2 -top-2 z-20 flex items-center gap-0.5 rounded-full border border-white/20 bg-[#07100c]/95 px-1.5 py-1 shadow-lg">{incidentKinds.map((kind) => <IncidentIcon key={kind} kind={kind} />)}</div>}

      {(isSubIn || isSubOut) && !incidentKinds.includes("substitution") && <div className={cn("absolute -left-2 top-1/2 z-20 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border bg-[#07100c]/95 shadow-lg", isSubIn ? "border-emerald-300/60" : "border-rose-300/60")}><IncidentIcon kind="substitution" direction={isSubIn ? "in" : "out"} /></div>}

      {cards.length > 0 && <div className="absolute -bottom-1 -right-1 z-20 flex items-center gap-0.5 rounded-full border border-white/20 bg-[#07100c]/95 px-1 py-0.5 shadow-lg">{cards.map((card: any, index: number) => <span key={`card-${index}`} title={card.cardType || "card"} className={cn("h-3.5 w-2.5 rounded-[3px] border border-white/80 shadow-[0_2px_4px_rgba(0,0,0,0.8)]", card.cardType === "red" ? "bg-rose-500" : card.cardType === "yellow_red" ? "bg-gradient-to-b from-amber-300 to-rose-500" : "bg-amber-300")} />)}</div>}

      <div className="relative z-10 flex h-9 w-9 items-center justify-center overflow-visible rounded-full border-2 bg-[#07100c] p-0.5 shadow-[0_7px_16px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:-translate-y-1 sm:h-11 sm:w-11" style={{ borderColor: teamColors.primary, boxShadow: `0 0 18px ${teamColors.primary}55` }}>
        {player.id && String(player.id) !== "0" ? <img src={`/api/player-image/${player.id}`} alt={player.shortName || player.name} className="h-full w-full rounded-full object-cover object-top" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span className={cn("text-sm font-black", isHome ? "text-[#b7ff4d]" : "text-white/80")}>{player.number || "?"}</span>}
        {player.number && <span className="absolute -bottom-0.5 -right-1 rounded-full border border-white/40 px-1 text-[7px] font-black leading-3" style={{ backgroundColor: teamColors.primary, color: teamColors.text }}>{player.number}</span>}
      </div>

      <div className="relative z-10 mt-1 w-full min-w-0 truncate px-0.5 text-center text-[8px] font-black leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] sm:text-[9px]">{player.shortName || player.name}</div>
    </div>
  );
}
