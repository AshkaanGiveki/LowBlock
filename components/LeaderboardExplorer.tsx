"use client";

import { useEffect, useState } from "react";
import { LeaderboardFilters } from "@/components/LeaderboardFilters";
import type { LeaderboardSelection } from "@/components/LeaderboardFilters";
import { InfiniteLeaderboard } from "@/components/InfiniteLeaderboard";

type Row = { userId: string; username: string; avatarUrl: string | null; isDefendingChampion?: boolean; points: number; exact: number; predictions: number; cursor?: { points: number; exact: number; predictions: number; userId: string } };

export function LeaderboardExplorer({ initialRows, seasonStartYear, leagueCode, lifetime, weekly = false, weekOffset = 0, me }: { initialRows: Row[]; seasonStartYear: number; leagueCode?: string; lifetime: boolean; weekly?: boolean; weekOffset?: number; me: string | null }) {
  const [selection, setSelection] = useState<LeaderboardSelection>({ lifetime, weekly, weekOffset, leagueCode });
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setSelection({ lifetime, weekly, weekOffset, leagueCode }); setRows(initialRows); }, [initialRows, lifetime, weekly, weekOffset, leagueCode]);
  async function change(selection: LeaderboardSelection) { setSelection(selection); setLoading(true); try { const query = new URLSearchParams({ limit: "100" }); if (selection.weekly) { query.set("weekly", "true"); if (selection.weekOffset) query.set("week", "previous"); } else if (!selection.lifetime) query.set("seasonStartYear", String(seasonStartYear)); if (selection.leagueCode) query.set("leagueCode", selection.leagueCode); const response = await fetch(`/api/leaderboards?${query}`); if (!response.ok) throw new Error("leaderboard request failed"); const data = await response.json(); setRows(data.rows ?? []); } finally { setLoading(false); } }
  return <><LeaderboardFilters lifetime={selection.lifetime} weekly={selection.weekly} weekOffset={selection.weekOffset} leagueCode={selection.leagueCode} onNavigate={change} />{loading ? <LeaderboardSkeleton /> : <InfiniteLeaderboard key={`${selection.weekly ? `weekly:${selection.weekOffset}` : selection.lifetime ? "lifetime" : "season"}:${selection.leagueCode ?? "all"}`} initialRows={rows} seasonStartYear={seasonStartYear} leagueCode={selection.leagueCode} lifetime={selection.lifetime} weekly={selection.weekly} weekOffset={selection.weekOffset} me={me}/>}</>;
}

function LeaderboardSkeleton() { return <section aria-label="Loading leaderboard" className="mt-8 animate-pulse space-y-4"><div className="grid gap-3 md:grid-cols-3"><div className="h-32 rounded-2xl bg-white/[.07]"/><div className="h-28 rounded-2xl bg-white/[.05]"/><div className="h-28 rounded-2xl bg-white/[.05]"/></div><div className="overflow-hidden rounded-3xl border border-white/[.07] bg-[#101512]">{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex items-center gap-3 border-b border-white/[.05] p-4"><span className="h-4 w-7 rounded bg-white/[.08]"/><span className="h-10 w-10 rounded-full bg-white/[.08]"/><span className="h-4 flex-1 rounded bg-white/[.08]"/><span className="h-5 w-14 rounded bg-brand/15"/></div>)}</div></section>; }
