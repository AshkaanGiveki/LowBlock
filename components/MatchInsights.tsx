"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { History, Shield, Users, X, Info } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatNumber } from "@/lib/text";
import { teamName } from "@/lib/football/team-names";
import { PitchLineup } from "./PitchLineup";
import { TeamCrest } from "./TeamCrest";
import { LocalShortDate } from "@/components/LocalDateTime";

type H2HMeeting = {
  fixtureId: string;
  date: string;
  homeTeam: { id: number; name: string; faName?: string; logoUrl: string | null };
  awayTeam: { id: number; name: string; faName?: string; logoUrl: string | null };
  homeGoals: number;
  awayGoals: number;
  league: string;
};

type LineupPlayer = {
  id: number;
  name: string;
  shortName?: string;
  number?: string | number;
  position?: string;
};

type LineupsData = {
  confirmed: boolean;
  home: {
    formation?: string;
    players: LineupPlayer[];
    substitutes: LineupPlayer[];
  };
  away: {
    formation?: string;
    players: LineupPlayer[];
    substitutes: LineupPlayer[];
  };
};

export function MatchInsightsPanel({ matchId }: { matchId: string }) {
  const { language, t } = useLanguage();
  const [lineups, setLineups] = useState<LineupsData | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [h2hData, setH2hData] = useState<H2HMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch(`/api/matches/${encodeURIComponent(matchId)}/analytics`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch(`/api/matches/${encodeURIComponent(matchId)}/insights`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([analytics, insights]) => {
        if (!mounted) return;
        if (analytics) {
          setMatchData(analytics.match ?? null);
          setLineups(analytics.liveDetails?.lineups ?? null);
        }
        if (insights && Array.isArray(insights.h2h)) {
          setH2hData(insights.h2h);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [matchId]);

  const n = (value: number) => formatNumber(value, language);

  if (loading) return <InsightsSkeleton />;

  const hasLineups = Boolean(
    lineups &&
      (lineups.home?.players?.length > 0 || lineups.away?.players?.length > 0),
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="space-y-4 overflow-hidden"
    >
      {/* 1. LINEUPS SECTION */}
      {hasLineups && matchData ? (
        <PitchLineup
          lineups={lineups!}
          match={matchData}
          language={language}
          t={t}
          incidents={[]}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-[#1a382d] bg-[#07100c]/60 p-5 text-center">
          <Users className="mx-auto mb-2 text-brand/70" size={24} />
          <h4 className="text-xs font-bold text-white mb-1">
            {t("ترکیب رسمی تیم‌ها", "Official Match Lineups")}
          </h4>
          <p className="text-[11px] text-white/50">
            {t(
              "ترکیب تیم‌ها معمولاً ۱ ساعت پیش از شروع مسابقه اعلام می‌شود.",
              "Official lineups are usually announced ~1 hour before kickoff.",
            )}
          </p>
        </div>
      )}

      {/* 2. HEAD TO HEAD (IF AVAILABLE) */}
      {h2hData.length > 0 && matchData && (
        <H2HCard
          data={h2hData}
          homeTeamId={matchData.homeTeam?.id ?? null}
          awayTeamId={matchData.awayTeam?.id ?? null}
          language={language}
          n={n}
          t={t}
        />
      )}
    </motion.div>
  );
}

function LineupsCard({
  lineups,
  match,
  language,
  t,
}: {
  lineups: LineupsData;
  match: any;
  language: "fa" | "en";
  t: (fa: string, en: string) => string;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const homeName = teamName(language, match.homeTeam?.id, match.homeTeam?.name, undefined, match.homeTeam?.faName);
  const awayName = teamName(language, match.awayTeam?.id, match.awayTeam?.name, undefined, match.awayTeam?.faName);
  const activeLineup = side === "home" ? lineups.home : lineups.away;

  return (
    <div className="rounded-2xl border border-[#1a382d] bg-[#07100c] p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-brand" />
          <span className="text-xs font-black text-white">
            {t("ترکیب تایید شده", "Confirmed Lineup")}
          </span>
        </div>
        {activeLineup.formation && (
          <span className="text-[10px] font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full">
            {activeLineup.formation}
          </span>
        )}
      </div>

      {/* Team Tabs */}
      <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
        <button
          type="button"
          onClick={() => setSide("home")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            side === "home"
              ? "bg-brand text-black shadow"
              : "text-white/50 hover:text-white"
          }`}
        >
          {homeName}
        </button>
        <button
          type="button"
          onClick={() => setSide("away")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            side === "away"
              ? "bg-brand text-black shadow"
              : "text-white/50 hover:text-white"
          }`}
        >
          {awayName}
        </button>
      </div>

      {/* Starting XI */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand block px-1">
          {t("ترکیب اصلی", "Starting XI")}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {activeLineup.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] p-2 hover:bg-white/[0.04] transition-colors"
            >
              <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand/40 bg-[#0a1a12] text-xs font-black text-brand">
                {p.id && String(p.id) !== "0" ? (
                  <img
                    src={`/api/player-image/${p.id}`}
                    alt=""
                    className="h-full w-full object-cover object-top"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                ) : null}
                <span>{p.number || p.name?.[0]?.toUpperCase() || "-"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {p.shortName || p.name}
                </p>
                <p className="text-[9px] font-semibold text-white/40">
                  {p.position || "FWD"}
                </p>
              </div>
              {p.number && (
                <span className="px-1 text-xs font-black text-white/30">
                  #{p.number}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Substitutes */}
      {activeLineup.substitutes?.length > 0 && (
        <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block px-1">
            {t("بازیکنان تعویضی", "Substitutes")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeLineup.substitutes.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 text-[11px] text-white/70"
              >
                {s.number && (
                  <strong className="text-brand font-black text-[10px]">
                    #{s.number}
                  </strong>
                )}
                <span className="truncate max-w-[120px]">{s.shortName || s.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function H2HCard({
  data,
  homeTeamId,
  awayTeamId,
  language,
  n,
  t,
}: {
  data: H2HMeeting[];
  homeTeamId: number | null;
  awayTeamId: number | null;
  language: "fa" | "en";
  n: (value: number) => string;
  t: (fa: string, en: string) => string;
}) {
  const summary = data.reduce(
    (acc, item) => {
      if (item.homeGoals === item.awayGoals) {
        acc.draw++;
        return acc;
      }
      const homeWon =
        homeTeamId === item.homeTeam.id
          ? item.homeGoals > item.awayGoals
          : homeTeamId === item.awayTeam.id
            ? item.awayGoals > item.homeGoals
            : false;
      const awayWon =
        awayTeamId === item.homeTeam.id
          ? item.homeGoals > item.awayGoals
          : awayTeamId === item.awayTeam.id
            ? item.awayGoals > item.homeGoals
            : false;
      if (homeWon) acc.home++;
      else if (awayWon) acc.away++;
      return acc;
    },
    { home: 0, draw: 0, away: 0 },
  );

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-brand/20 bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.16),transparent_45%),rgba(0,0,0,.16)]">
      <div className="flex items-center gap-3 border-b border-white/[.07] p-3.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand">
          <History size={19} />
        </span>
        <div>
          <h3 className="text-sm font-black">
            {t("پنج رویارویی آخر", "LAST FIVE MEETINGS")}
          </h3>
          <p className="mt-1 text-[9px] text-[var(--muted)]">
            {t("سابقه مستقیم دو تیم", "Direct history between the teams")}
          </p>
        </div>
        <span className="ms-auto text-[10px] font-black text-[var(--muted)]">
          {n(data.length)} {t("بازی", "matches")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 text-center">
        <div className="rounded-xl bg-brand/10 p-2">
          <b className="block text-lg text-brand">{n(summary.home)}</b>
          <small className="text-[9px] text-[var(--muted)]">
            {t("برد میزبان", "Home wins")}
          </small>
        </div>
        <div className="rounded-xl bg-white/[.04] p-2">
          <b className="block text-lg">{n(summary.draw)}</b>
          <small className="text-[9px] text-[var(--muted)]">
            {t("مساوی", "Draws")}
          </small>
        </div>
        <div className="rounded-xl bg-red-400/10 p-2">
          <b className="block text-lg text-red-300">{n(summary.away)}</b>
          <small className="text-[9px] text-[var(--muted)]">
            {t("برد مهمان", "Away wins")}
          </small>
        </div>
      </div>
      <div className="px-4 pb-3">
        {data.length ? (
          data.map((item) => (
            <div
              key={item.fixtureId}
              className="flex items-center gap-2 border-t border-white/[.05] py-2.5"
            >
              <TeamCrest
                name={item.homeTeam.name}
                logo={item.homeTeam.logoUrl}
                className="h-7 w-7 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                {teamName(language, item.homeTeam.id, item.homeTeam.name, undefined, item.homeTeam.faName)}
              </span>
              <b className="shrink-0 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[11px]">
                {n(item.homeGoals)} - {n(item.awayGoals)}
              </b>
              <span className="min-w-0 flex-1 truncate text-end text-[11px] font-bold">
                {teamName(language, item.awayTeam.id, item.awayTeam.name, undefined, item.awayTeam.faName)}
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[.05] p-1">
                <TeamCrest
                  name={item.awayTeam.name}
                  logo={item.awayTeam.logoUrl}
                />
              </span>
              <time className="hidden w-16 text-end text-[9px] text-[var(--muted)] sm:block">
                <LocalShortDate
                  value={item.date}
                  locale={language === "fa" ? "fa-IR" : "en-GB"}
                />
              </time>
            </div>
          ))
        ) : (
          <p className="p-4 text-center text-xs text-[var(--muted)]">
            {t(
              "سابقه رودررو موجود نیست.",
              "No head-to-head history available.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-16 animate-pulse rounded-[1.35rem] bg-white/[.06]" />
      <div className="h-44 animate-pulse rounded-[1.35rem] bg-white/[.06]" />
    </div>
  );
}
