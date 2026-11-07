"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { T } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import H2HHero from "@/components/H2HHero";
import H2HTodayMatches from "@/components/H2HTodayMatches";
import H2HRoundMatches from "@/components/H2HRoundMatches";

function Skeleton() { return <div className="mt-6 animate-pulse space-y-5" aria-label="Loading SuperLeague details"><div className="h-20 rounded-[1.35rem] border border-white/[.06] bg-white/[.04]" /><div className="h-72 max-w-5xl rounded-[1.5rem] border border-white/[.06] bg-white/[.04]" /><div className="h-80 max-w-2xl rounded-2xl border border-white/[.06] bg-white/[.04]" /></div>; }

function Standings({ rows, viewerId }: { rows: any[]; viewerId: string }) {
  return <section className="mt-8 max-w-2xl overflow-hidden rounded-2xl border border-white/[.08] bg-[#101512]"><div className="flex items-center gap-2 border-b border-white/[.07] px-3 py-3 text-brand sm:px-4"><Crown size={14} /><h2 className="text-sm font-black"><T fa="Ø¬Ø¯ÙˆÙ„ Ø±ØªØ¨Ù‡â€ŒØ¨Ù†Ø¯ÛŒ" en="Standings" /></h2></div><div className="divide-y divide-white/[.05]">{rows.map((row: any) => <div key={row.userId} className={`grid grid-cols-[26px_minmax(0,1fr)_42px_48px] items-center gap-2 px-3 py-2 sm:px-4 ${row.userId === viewerId ? "bg-brand/[.07]" : ""}`}><span className="text-xs font-black text-brand">{row.rank}</span><div className="flex min-w-0 items-center gap-2"><UserAvatar name={row.username} avatarUrl={row.avatarUrl} className="h-7 w-7 shrink-0 text-[8px]" /><span className="truncate text-[10px] font-bold text-white/80 sm:text-[11px]">{row.username}</span></div><span className="justify-self-center rounded-lg bg-brand/15 px-2 py-1 text-[11px] font-black text-brand">{row.h2hPoints}</span><span className="justify-self-center rounded-lg bg-white/[.06] px-2 py-1 text-[11px] font-black text-white/75">{row.predictionPoints ?? 0}</span></div>)}</div></section>;
}

export default function SuperLeagueBoard() {
  const [data, setData] = useState<any>();
  const [detail, setDetail] = useState<any>();
  const [weekIndex, setWeekIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cache = useRef(new Map<string, any>());
  const loadDetail = (weekKey: string) => { const cached = cache.current.get(weekKey); if (cached) { setDetail(cached); return; } setLoading(true); fetch(`/api/superleague/week/${encodeURIComponent(weekKey)}`, { cache: "no-store" }).then((r) => r.json()).then((next) => { cache.current.set(weekKey, next); setDetail(next); }).catch(() => setError("Could not load SuperLeague details")).finally(() => setLoading(false)); };
  useEffect(() => { fetch("/api/h2h/current", { cache: "no-store" }).then((r) => r.json()).then((next) => { setData(next); if (next.league?.weekKey) loadDetail(next.league.weekKey); }).catch(() => setError("Could not load SuperLeague")); }, []);
  if (!data) return <main className="min-h-screen bg-[#080b0a] px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl"><H2HHero slateCount={7} activeSlate={1} progressSlate={1} /><Skeleton /></div></main>;
  if (!data.enabled) return null;
  const weekKeys: string[] = data.availableWeeks?.length ? data.availableWeeks : (data.league?.weekKey ? [data.league.weekKey] : []);
  if (!data.league && !weekKeys.length) return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl"><H2HHero slateCount={7} activeSlate={1} progressSlate={1} /><p className="mt-6 max-w-2xl rounded-2xl border border-white/[.08] bg-[#101713] p-5 text-sm text-white/60">{data.reason === "NO_CLUB" ? "Join a club to enter SuperLeague." : "This week’s SuperLeague group is being prepared."}</p></div></main>;
  const league = detail?.league;
  if (loading || !league) return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl"><H2HHero slateCount={7} activeSlate={1} progressSlate={1} /><Skeleton /></div></main>;
  const matchdays = Array.from({ length: 7 }, (_, i) => i + 1); const round = league.h2hMatches?.find((item: any) => item.matchday === matchdays[roundIndex]); const slate = league.slates.find((item: any) => item.matchday === matchdays[roundIndex]);
  const moveWeek = (direction: number) => { const next = Math.min(weekKeys.length - 1, Math.max(0, weekIndex + direction)); if (next === weekIndex) return; setWeekIndex(next); setDetail(undefined); setRoundIndex(0); loadDetail(weekKeys[next]); };
  const moveRound = (direction: number) => setRoundIndex((current) => Math.min(6, Math.max(0, current + direction)));
  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl"><H2HHero slateCount={7} activeSlate={roundIndex + 1} progressSlate={roundIndex + 1} />{data.viewerIncluded && <H2HTodayMatches slates={league.slates} leagueId={league.id} />}
    <section dir="ltr" className="mt-6 flex items-center justify-between rounded-[1.35rem] border border-white/[.08] bg-[#101713] px-3 py-3.5 shadow-[0_16px_50px_rgba(0,0,0,.16)] md:px-5"><button type="button" onClick={() => moveWeek(-1)} disabled={weekIndex <= 0} aria-label="Previous SuperLeague week" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25"><ChevronLeft size={20} /></button><div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.2em] text-brand"><T fa="Ù‡ÙØªÙ‡ Ø³ÙˆÙ¾Ø±Ù„ÛŒÚ¯" en="SUPERLEAGUE WEEK" /></p><h2 className="mt-0.5 text-xl font-black"><T fa="Ù‡ÙØª" en="Week" /> {weekIndex + 1}</h2><p className="mt-0.5 text-[10px] text-white/35">{weekKeys[weekIndex]}</p></div><button type="button" onClick={() => moveWeek(1)} disabled={weekIndex >= weekKeys.length - 1} aria-label="Next SuperLeague week" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25"><ChevronRight size={20} /></button></section>
    <section dir="ltr" className="mt-3 flex items-center justify-between rounded-2xl border border-white/[.06] bg-white/[.02] px-3 py-2"><button type="button" onClick={() => moveRound(-1)} disabled={roundIndex <= 0} aria-label="Previous round" className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:bg-white/[.06] disabled:opacity-20"><ChevronLeft size={17} /></button><span className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">Round {roundIndex + 1}{slate?.sourceDate ? ` · ${slate.sourceDate}` : ""}</span><button type="button" onClick={() => moveRound(1)} disabled={roundIndex >= 6} aria-label="Next round" className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:bg-white/[.06] disabled:opacity-20"><ChevronRight size={17} /></button></section>
    <H2HRoundMatches round={round} /><Standings rows={league.standings} viewerId={league.viewerId} />{error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}</div></main>;
}
