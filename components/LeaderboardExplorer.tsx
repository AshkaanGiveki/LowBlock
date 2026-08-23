"use client";

import { useEffect, useState } from "react";
import { LeaderboardFilters } from "@/components/LeaderboardFilters";
import { InfiniteLeaderboard } from "@/components/InfiniteLeaderboard";

type Row = { userId: string; username: string; avatarUrl: string | null; points: number; exact: number; predictions: number; cursor?: { points: number; exact: number; predictions: number; userId: string } };

export function LeaderboardExplorer({ initialRows, seasonStartYear, leagueCode, lifetime, me }: { initialRows: Row[]; seasonStartYear: number; leagueCode?: string; lifetime: boolean; me: string | null }) {
  const [localPending, setLocalPending] = useState(false);
  useEffect(() => setLocalPending(false), [lifetime, leagueCode]);
  const loading = localPending;
  return <><LeaderboardFilters lifetime={lifetime} leagueCode={leagueCode} onNavigate={() => setLocalPending(true)} />{loading ? <LeaderboardSkeleton /> : <InfiniteLeaderboard key={`${lifetime ? "lifetime" : "season"}:${leagueCode ?? "all"}`} initialRows={initialRows} seasonStartYear={seasonStartYear} leagueCode={leagueCode} lifetime={lifetime} me={me}/>}</>;
}

function LeaderboardSkeleton() { return <section aria-label="Loading leaderboard" className="mt-8 animate-pulse space-y-4"><div className="grid gap-3 md:grid-cols-3"><div className="h-32 rounded-2xl bg-white/[.07]"/><div className="h-28 rounded-2xl bg-white/[.05]"/><div className="h-28 rounded-2xl bg-white/[.05]"/></div><div className="overflow-hidden rounded-3xl border border-white/[.07] bg-[#101512]">{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex items-center gap-3 border-b border-white/[.05] p-4"><span className="h-4 w-7 rounded bg-white/[.08]"/><span className="h-10 w-10 rounded-full bg-white/[.08]"/><span className="h-4 flex-1 rounded bg-white/[.08]"/><span className="h-5 w-14 rounded bg-brand/15"/></div>)}</div></section>; }
