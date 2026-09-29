"use client";

import { useEffect, useState, useMemo } from "react";
import type { MatchRecord } from "@/lib/football/data";
import type {
  LiveMatchSnapshot,
  LiveIncident,
  LiveStatGroup,
  LiveLineups,
  LiveOddsMarket,
} from "@/lib/football/sportsapi/matchMonitor";
import { TeamCrest } from "./TeamCrest";

type Props = {
  match: MatchRecord;
  initialSnapshot?: LiveMatchSnapshot | null;
};

export function LiveMatchCenter({ match, initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<LiveMatchSnapshot | null>(
    initialSnapshot ?? null,
  );
  const [activeTab, setActiveTab] = useState<
    "timeline" | "stats" | "lineups" | "odds"
  >("timeline");
  const [isConnected, setIsConnected] = useState(false);

  const matchId = match.providerMatchId;

  // Real-time SSE / Streaming hook
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    // Fetch initial JSON snapshot immediately
    fetch(`/api/matches/${matchId}/live`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isUnmounted && data) {
          setSnapshot(data);
        }
      })
      .catch((err) => console.warn("[LiveCenter] Initial fetch error:", err));

    // Connect to SSE stream
    try {
      eventSource = new EventSource(`/api/matches/${matchId}/live?stream=true`);

      eventSource.onopen = () => {
        if (!isUnmounted) setIsConnected(true);
      };

      eventSource.addEventListener("snapshot", (e) => {
        if (isUnmounted) return;
        try {
          const data = JSON.parse(e.data);
          setSnapshot(data);
          setIsConnected(true);
        } catch {}
      });

      eventSource.addEventListener("update", (e) => {
        if (isUnmounted) return;
        try {
          const data = JSON.parse(e.data);
          setSnapshot(data);
          setIsConnected(true);
        } catch {}
      });

      eventSource.onerror = () => {
        if (isUnmounted) return;
        setIsConnected(false);
        // Fallback: poll every 6s if SSE drops
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            fetch(`/api/matches/${matchId}/live`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (!isUnmounted && data) setSnapshot(data);
              })
              .catch(() => {});
          }, 6000);
        }
      };
    } catch {
      // Fallback polling
      pollInterval = setInterval(() => {
        fetch(`/api/matches/${matchId}/live`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!isUnmounted && data) setSnapshot(data);
          })
          .catch(() => {});
      }, 6000);
    }

    return () => {
      isUnmounted = true;
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [matchId]);

  // Derived scores and status
  const isLive = snapshot?.score?.status === "LIVE" || match.status === "LIVE";
  const isFinished =
    snapshot?.score?.status === "FINISHED" || match.status === "FINISHED";

  const homeGoals = snapshot?.score?.home ?? match.homeGoals ?? 0;
  const awayGoals = snapshot?.score?.away ?? match.awayGoals ?? 0;
  const elapsed = snapshot?.score?.elapsed ?? match.elapsed ?? null;

  const incidents = snapshot?.incidents ?? [];
  const statsGroups = snapshot?.stats ?? [];
  const lineups = snapshot?.lineups ?? null;
  const odds = snapshot?.odds ?? [];

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl shadow-2xl transition-all">
      {/* 1. Live Match Header & Scoreboard */}
      <div className="relative border-b border-white/10 p-6 md:p-8 bg-gradient-to-b from-white/[.04] to-transparent">
        {/* Connection & Live Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black tracking-wider text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                LIVE {elapsed ? `${elapsed}'` : ""}
              </span>
            ) : isFinished ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black tracking-wider text-white/70 border border-white/10">
                FULL TIME
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black tracking-wider text-amber-400 border border-amber-500/20">
                UPCOMING
              </span>
            )}

            {isConnected && (
              <span
                title="Real-time WebSocket connection active"
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-white/40"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Real-time feed
              </span>
            )}
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-white/40">
              {match.leagueCode}
            </span>
          </div>
        </div>

        {/* Teams and Score Hero */}
        <div className="grid grid-cols-3 items-center gap-2 md:gap-6 py-2">
          {/* Home Team */}
          <div className="flex flex-col items-center text-center">
            <TeamCrest
              name={match.homeTeam.name}
              logo={match.homeTeam.logoUrl}
              className="h-16 w-16 md:h-20 md:w-20 drop-shadow-md"
            />
            <h3 className="mt-3 text-base md:text-xl font-black text-white line-clamp-1">
              {match.homeTeam.name}
            </h3>
            {lineups?.home?.formation && (
              <span className="mt-1 text-[11px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-md border border-brand/20">
                {lineups.home.formation}
              </span>
            )}
          </div>

          {/* Live Score Display */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-3 md:gap-5">
              <span className="text-4xl md:text-6xl font-black text-white tracking-tight">
                {isLive || isFinished ? homeGoals : "-"}
              </span>
              <span className="text-2xl md:text-4xl font-black text-white/30">
                :
              </span>
              <span className="text-4xl md:text-6xl font-black text-white tracking-tight">
                {isLive || isFinished ? awayGoals : "-"}
              </span>
            </div>

            {/* Half-time period score */}
            {snapshot?.score?.period1?.home !== null &&
              snapshot?.score?.period1?.home !== undefined && (
                <span className="mt-2 text-xs font-medium text-white/40">
                  HT: {snapshot.score.period1.home} -{" "}
                  {snapshot.score.period1.away}
                </span>
              )}
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center text-center">
            <TeamCrest
              name={match.awayTeam.name}
              logo={match.awayTeam.logoUrl}
              className="h-16 w-16 md:h-20 md:w-20 drop-shadow-md"
            />
            <h3 className="mt-3 text-base md:text-xl font-black text-white line-clamp-1">
              {match.awayTeam.name}
            </h3>
            {lineups?.away?.formation && (
              <span className="mt-1 text-[11px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-md border border-brand/20">
                {lineups.away.formation}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Navigation Tabs */}
      <div className="flex border-b border-white/10 px-4 md:px-8 bg-white/[.02]">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex items-center gap-2 py-4 px-4 text-xs md:text-sm font-black transition-colors border-b-2 -mb-px ${
            activeTab === "timeline"
              ? "border-brand text-brand"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <span>⏱</span>
          <span>Timeline</span>
          {incidents.length > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] text-white">
              {incidents.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("stats")}
          className={`flex items-center gap-2 py-4 px-4 text-xs md:text-sm font-black transition-colors border-b-2 -mb-px ${
            activeTab === "stats"
              ? "border-brand text-brand"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <span>📊</span>
          <span>Match Stats</span>
        </button>

        <button
          onClick={() => setActiveTab("lineups")}
          className={`flex items-center gap-2 py-4 px-4 text-xs md:text-sm font-black transition-colors border-b-2 -mb-px ${
            activeTab === "lineups"
              ? "border-brand text-brand"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <span>👥</span>
          <span>Lineups</span>
          {lineups?.confirmed && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-400">
              Confirmed
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("odds")}
          className={`flex items-center gap-2 py-4 px-4 text-xs md:text-sm font-black transition-colors border-b-2 -mb-px ${
            activeTab === "odds"
              ? "border-brand text-brand"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <span>📈</span>
          <span>Live Odds</span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      <div className="p-6 md:p-8">
        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="max-w-2xl mx-auto">
            {incidents.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-sm">
                No incidents recorded yet. Match events (goals, cards, substitutions) will stream live here.
              </div>
            ) : (
              <div className="relative border-l border-white/10 ml-6 pl-6 space-y-6">
                {incidents.map((inc) => (
                  <div key={inc.id} className="relative group">
                    {/* Minute Circle Badge */}
                    <div className="absolute -left-[35px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#161b22] border border-white/20 text-[11px] font-black text-white group-hover:border-brand transition-colors">
                      {inc.time}&apos;
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[.02] p-4 hover:border-white/15 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {inc.type === "goal" && "⚽"}
                          {inc.type === "card" &&
                            (inc.cardType === "red" ? "🟥" : "🟨")}
                          {inc.type === "substitution" && "🔄"}
                          {inc.type === "period" && "⏱"}
                          {inc.type === "var" && "🖥️"}
                        </span>

                        <div>
                          <p className="text-sm font-black text-white">
                            {inc.type === "goal" &&
                              `Goal! ${inc.playerName || "Player"}`}
                            {inc.type === "card" &&
                              `${inc.cardType === "red" ? "Red Card" : "Yellow Card"}: ${inc.playerName || "Player"}`}
                            {inc.type === "substitution" && (
                              <span>
                                In: <strong className="text-emerald-400">{inc.playerInName}</strong>{" "}
                                | Out: <span className="text-white/40">{inc.playerOutName}</span>
                              </span>
                            )}
                            {inc.type === "period" && inc.detail}
                          </p>
                          {inc.detail && inc.type !== "period" && (
                            <p className="text-xs text-white/40 mt-0.5">
                              {inc.detail}
                            </p>
                          )}
                        </div>
                      </div>

                      {inc.score && (
                        <div className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-black text-white">
                          {inc.score.home} - {inc.score.away}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === "stats" && (
          <div className="max-w-2xl mx-auto space-y-6">
            {statsGroups.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-sm">
                Detailed match statistics are preparing or match has not begun.
              </div>
            ) : (
              statsGroups.map((group, gIdx) => (
                <div
                  key={gIdx}
                  className="rounded-2xl border border-white/5 bg-white/[.02] p-6"
                >
                  <h4 className="text-xs font-black text-brand tracking-widest uppercase mb-6">
                    {group.groupName}
                  </h4>

                  <div className="space-y-5">
                    {group.items.map((stat, sIdx) => {
                      const hVal = Number((stat.homeValue ?? parseFloat(String(stat.home))) || 0);
                      const aVal = Number((stat.awayValue ?? parseFloat(String(stat.away))) || 0);
                      const total = hVal + aVal || 1;
                      const homePct = Math.round((hVal / total) * 100);

                      return (
                        <div key={sIdx} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-white">{stat.home}</span>
                            <span className="text-white/50">{stat.name}</span>
                            <span className="text-white">{stat.away}</span>
                          </div>

                          {/* Comparative Progress Bar */}
                          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              style={{ width: `${homePct}%` }}
                              className="bg-brand transition-all duration-500 rounded-l-full"
                            />
                            <div
                              style={{ width: `${100 - homePct}%` }}
                              className="bg-white/30 transition-all duration-500 rounded-r-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* LINEUPS TAB */}
        {activeTab === "lineups" && (
          <div className="max-w-4xl mx-auto">
            {!lineups ? (
              <div className="text-center py-12 text-white/40 text-sm">
                Starting lineups have not been announced yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Home Team Lineup */}
                <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                    <h4 className="font-black text-white text-base">
                      {match.homeTeam.name}
                    </h4>
                    {lineups.home.formation && (
                      <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                        {lineups.home.formation}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-black text-white/40 tracking-wider uppercase mb-3">
                    Starting XI
                  </p>
                  <ul className="space-y-2">
                    {lineups.home.players.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[.02] hover:bg-white/[.05] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-white/80">
                            {p.number || "-"}
                          </span>
                          <span className="font-bold text-white">{p.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-white/40 uppercase">
                          {p.position}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {lineups.home.substitutes.length > 0 && (
                    <>
                      <p className="text-xs font-black text-white/40 tracking-wider uppercase mt-6 mb-3">
                        Substitutes
                      </p>
                      <ul className="space-y-2">
                        {lineups.home.substitutes.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[.01] hover:bg-white/[.04] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center font-bold text-[10px] text-white/50">
                                {p.number || "-"}
                              </span>
                              <span className="text-white/70">{p.name}</span>
                            </div>
                            <span className="text-[10px] text-white/30 uppercase">
                              {p.position}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {/* Away Team Lineup */}
                <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                    <h4 className="font-black text-white text-base">
                      {match.awayTeam.name}
                    </h4>
                    {lineups.away.formation && (
                      <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                        {lineups.away.formation}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-black text-white/40 tracking-wider uppercase mb-3">
                    Starting XI
                  </p>
                  <ul className="space-y-2">
                    {lineups.away.players.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[.02] hover:bg-white/[.05] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-white/80">
                            {p.number || "-"}
                          </span>
                          <span className="font-bold text-white">{p.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-white/40 uppercase">
                          {p.position}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {lineups.away.substitutes.length > 0 && (
                    <>
                      <p className="text-xs font-black text-white/40 tracking-wider uppercase mt-6 mb-3">
                        Substitutes
                      </p>
                      <ul className="space-y-2">
                        {lineups.away.substitutes.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[.01] hover:bg-white/[.04] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center font-bold text-[10px] text-white/50">
                                {p.number || "-"}
                              </span>
                              <span className="text-white/70">{p.name}</span>
                            </div>
                            <span className="text-[10px] text-white/30 uppercase">
                              {p.position}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ODDS TAB */}
        {activeTab === "odds" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {odds.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-sm">
                Live odds are currently not active for this event.
              </div>
            ) : (
              odds.map((market, mIdx) => (
                <div
                  key={mIdx}
                  className="rounded-2xl border border-white/5 bg-white/[.02] p-6"
                >
                  <h4 className="text-xs font-black text-white/70 uppercase tracking-widest mb-4">
                    {market.name}
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {market.choices.map((choice, cIdx) => (
                      <div
                        key={cIdx}
                        className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[.03] p-3.5 hover:border-brand/40 transition-all"
                      >
                        <span className="text-xs text-white/50 font-bold mb-1">
                          {choice.name === "1"
                            ? (match.homeTeam as any).shortName || match.homeTeam.name
                            : choice.name === "2"
                              ? (match.awayTeam as any).shortName || match.awayTeam.name
                              : choice.name === "X"
                                ? "Draw"
                                : choice.name}
                        </span>
                        <span className="text-base font-black text-brand tracking-wide">
                          {choice.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
