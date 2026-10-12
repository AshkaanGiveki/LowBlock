"use client";

import { useState } from "react";
import { ChevronDown, Check, Minus, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { T } from "@/components/LanguageProvider";
import { LocalTime } from "@/components/LocalDateTime";
import { UserAvatar } from "@/components/UserAvatar";

function predictionLabel(prediction: any) {
  if (!prediction) return "—";
  return `${prediction.homeGoals ?? "-"} : ${prediction.awayGoals ?? "-"}`;
}

export default function H2HRoundMatches({ round }: { round: any }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!round) return null;
  return (
    <section className="mt-6">
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
          return (
            <motion.article layout key={`${match.playerA?.userId}-${match.playerB?.userId}`} className={`overflow-hidden rounded-[1.35rem] border bg-[#101713] transition ${isExpanded ? "border-brand/45 shadow-[0_18px_46px_rgba(0,0,0,.2)]" : "border-white/[.08]"}`}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                  <span className="truncate text-sm font-black">{match.playerA?.username}</span>
                  <UserAvatar name={match.playerA?.username ?? "A"} avatarUrl={match.playerA?.avatarUrl} className="h-9 w-9 text-[10px]" />
                </div>
                <div className="grid shrink-0 place-items-center gap-0.5">
                  <span className="text-[9px] font-black uppercase tracking-[.15em] text-white/30">VS</span>
                  <span className={`text-lg font-black ${isFinished ? "text-white" : "text-white/30"}`}>{isFinished ? `${match.scoreA}–${match.scoreB}` : "—"}</span>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <UserAvatar name={match.playerB?.username ?? "B"} avatarUrl={match.playerB?.avatarUrl} className="h-9 w-9 text-[10px]" />
                  <span className="truncate text-sm font-black">{match.playerB?.username}</span>
                </div>
                <button type="button" onClick={() => setExpanded(isExpanded ? null : index)} aria-expanded={isExpanded} aria-label={isExpanded ? "Collapse matchup" : "Expand matchup"} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${isExpanded ? "border-brand/40 bg-brand/15 text-brand" : "border-white/10 text-white/45 hover:border-brand/40 hover:text-brand"}`}><motion.span animate={{ rotate: isExpanded ? 180 : 0 }}><ChevronDown size={16} /></motion.span></button>
              </div>
              <div className="flex items-center justify-between border-t border-white/[.06] px-4 py-2 text-[10px] text-white/40"><span>{match.fixtures.length} <T fa="مسابقه فوتبال" en="football matches" /></span><span className="inline-flex items-center gap-1">{isFinished ? <><Check size={12} className="text-brand" /><T fa="تمام‌شده" en="Finished" /></> : <><Minus size={12} /><T fa="در انتظار نتیجه" en="Awaiting results" /></>}</span></div>
              <AnimatePresence initial={false}>{isExpanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/[.07]"><div className="divide-y divide-white/[.06]">{match.fixtures.map((fixture: any) => <div key={fixture.matchId} className="px-4 py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{fixture.homeTeam?.name} <span className="px-1 text-white/25">vs</span> {fixture.awayTeam?.name}</p><p className="mt-1 text-[10px] text-white/35"><LocalTime value={fixture.kickoffAt} /></p></div>{fixture.homeGoals !== null && fixture.awayGoals !== null ? <span className="rounded-lg bg-white/[.06] px-2 py-1 text-xs font-black">{fixture.homeGoals} : {fixture.awayGoals}</span> : <span className="text-[10px] text-white/30"><T fa="نتیجه ثبت نشده" en="No result" /></span>}</div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div className="flex items-center justify-between rounded-lg bg-brand/[.06] px-2.5 py-2"><span className="truncate text-white/55">{match.playerA?.username}</span><span className="font-black text-brand">{predictionLabel(fixture.predictions.playerA)} <em className="ms-1 not-italic text-white/45">+{fixture.scores.playerA.points}</em></span></div><div className="flex items-center justify-between rounded-lg bg-white/[.04] px-2.5 py-2"><span className="truncate text-white/55">{match.playerB?.username}</span><span className="font-black text-white/80">{predictionLabel(fixture.predictions.playerB)} <em className="ms-1 not-italic text-white/45">+{fixture.scores.playerB.points}</em></span></div></div></div>)}</div></motion.div>}</AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
