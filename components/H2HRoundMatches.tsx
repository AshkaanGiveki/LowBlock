"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { T, useLanguage } from "@/components/LanguageProvider";
import { LocalTime } from "@/components/LocalDateTime";
import { TeamCrest } from "@/components/TeamCrest";
import { UserAvatar } from "@/components/UserAvatar";

function predictionLabel(prediction: any) {
  if (!prediction) return "—";
  return `${prediction.homeGoals ?? "-"} : ${prediction.awayGoals ?? "-"}`;
}

function scoreCircle(points: number, highlighted: boolean, finished: boolean) {
  return (
    <span className={`grid h-8 min-w-8 place-items-center rounded-full px-1 text-[11px] font-black ${highlighted ? "bg-brand text-[#06120c] shadow-[0_0_16px_rgba(32,184,121,.28)]" : "border border-white/10 bg-white/[.06] text-white/75"}`}>
      {finished ? points : "—"}
    </span>
  );
}

function MatchTeam({ team }: { team: any }) {
  const name = team?.faName || team?.name;
  const logo = team?.logoUrl || team?.logo || (team?.id ? `/api/team-image/${team.id}` : null);
  return <TeamCrest name={name ?? "Team"} logo={logo} className="mx-auto h-6 w-6 rounded-lg" />;
}

function PlayerSide({ player, prediction, gold, align, language }: { player: any; prediction: any; gold: boolean; align: "left" | "right"; language: "fa" | "en" }) {
  const avatar = <span title={gold ? (language === "fa" ? "انتخاب طلایی" : "Gold pick") : player?.username} className={`relative inline-flex rounded-full ${gold ? "ring-2 ring-[#e8c66a]/80 ring-offset-1 ring-offset-[#101713]" : ""}`}><UserAvatar name={player?.username ?? "Player"} avatarUrl={player?.avatarUrl} className="h-6 w-6 text-[7px]" />{gold && <span className="absolute -end-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-[#e8c66a] text-[#241d08]"><Sparkles size={8} /></span>}</span>;
  const predictionValue = <span className={`text-[10px] font-black ${prediction ? "text-brand" : "text-white/25"}`}>{prediction ? predictionLabel(prediction) : "—"}</span>;
  return align === "right" ? <div className="flex min-w-0 items-center justify-end gap-2">{predictionValue}{avatar}</div> : <div className="flex min-w-0 items-center justify-start gap-2">{avatar}{predictionValue}</div>;
}

function FixtureDetails({ fixture, match, language }: { fixture: any; match: any; language: "fa" | "en" }) {
  const finished = fixture.homeGoals !== null && fixture.awayGoals !== null;
  const playerAScore = fixture.scores?.playerA?.points ?? 0;
  const playerBScore = fixture.scores?.playerB?.points ?? 0;
  const winner = finished && playerAScore !== playerBScore ? (playerAScore > playerBScore ? "A" : "B") : null;

  return (
    <div className="px-2.5 py-2">
      <div className="rounded-lg border border-white/[.07] bg-white/[.025] px-2.5 py-1.5">
        <div className="mb-1 flex items-center justify-center gap-2 text-[8px] text-white/30">
          <span className="uppercase tracking-[.14em]">{fixture.leagueCode}</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <LocalTime value={fixture.kickoffAt} />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <MatchTeam team={fixture.homeTeam} />
          <span className={`min-w-[44px] text-center text-base font-black tracking-wide ${finished ? "text-white" : "text-white/35"}`}>{finished ? `${fixture.homeGoals} : ${fixture.awayGoals}` : "—"}</span>
          <MatchTeam team={fixture.awayTeam} />
        </div>
      </div>

      <div className="mt-1.5 rounded-lg border border-white/[.06] bg-black/10 px-2 py-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <PlayerSide player={match.playerA} prediction={fixture.predictions?.playerA} gold={Boolean(fixture.isGold?.playerA)} align="right" language={language} />
          <div className="flex items-center justify-center gap-1.5">
            {scoreCircle(playerAScore, winner === "A", finished)}
            <span className="text-xs font-normal text-white/25">–</span>
            {scoreCircle(playerBScore, winner === "B", finished)}
          </div>
          <PlayerSide player={match.playerB} prediction={fixture.predictions?.playerB} gold={Boolean(fixture.isGold?.playerB)} align="left" language={language} />
        </div>
      </div>
    </div>
  );
}

export default function H2HRoundMatches({ round }: { round: any }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { language } = useLanguage();
  if (!round) return null;
  return (
    <section className="mt-6 max-w-5xl">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-brand"><T fa="رویارویی بازیکن‌ها" en="PLAYER MATCHUPS" /></p>
          <h2 className="mt-1 text-2xl font-black"><T fa="مسابقه‌های این راند" en="Round matchups" /></h2>
        </div>
        <span className="text-xs text-white/35">{round.pairings.length} <T fa="رویارویی" en="duels" /></span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {round.pairings.map((match: any, index: number) => {
          const isExpanded = expanded === index;
          const isFinished = match.fixtures.every((fixture: any) => fixture.homeGoals !== null && fixture.awayGoals !== null);
          const winner = match.winner;
          return (
            <motion.div layout key={`${match.playerA?.userId}-${match.playerB?.userId}`} role="button" tabIndex={0} aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpanded(isExpanded ? null : index); } }} className={`cursor-pointer overflow-hidden rounded-[1.15rem] border bg-[#101713] transition ${isExpanded ? "border-brand/45 shadow-[0_18px_46px_rgba(0,0,0,.2)]" : "border-white/[.08] hover:border-white/20"}`}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right"><span className="truncate text-xs font-bold text-white/85">{match.playerA?.username}</span><UserAvatar name={match.playerA?.username ?? "A"} avatarUrl={match.playerA?.avatarUrl} className="h-8 w-8 text-[9px]" /></div>
                <div className="flex shrink-0 items-center gap-1.5">{scoreCircle(match.scoreA, winner === match.playerA?.userId, isFinished)}<span className="text-sm font-normal text-white/25">–</span>{scoreCircle(match.scoreB, winner === match.playerB?.userId, isFinished)}</div>
                <div className="flex min-w-0 flex-1 items-center gap-2"><UserAvatar name={match.playerB?.username ?? "B"} avatarUrl={match.playerB?.avatarUrl} className="h-8 w-8 text-[9px]" /><span className="truncate text-xs font-bold text-white/85">{match.playerB?.username}</span></div>
                <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition ${isExpanded ? "bg-brand/15 text-brand" : "text-white/35"}`}><motion.span animate={{ rotate: isExpanded ? 180 : 0 }}><ChevronDown size={14} /></motion.span></span>
              </div>
              <AnimatePresence initial={false}>{isExpanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/[.07]"><div className="divide-y divide-white/[.06]">{match.fixtures.map((fixture: any) => <FixtureDetails key={fixture.matchId} fixture={fixture} match={match} language={language} />)}</div></motion.div>}</AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
