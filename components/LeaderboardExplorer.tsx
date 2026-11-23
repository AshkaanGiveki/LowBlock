"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LeaderboardFilters } from "@/components/LeaderboardFilters";
import type { LeaderboardSelection } from "@/components/LeaderboardFilters";
import { InfiniteLeaderboard } from "@/components/InfiniteLeaderboard";
import { useLanguage } from "@/components/LanguageProvider";

type Row = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isDefendingChampion?: boolean;
  points: number;
  exact: number;
  predictions: number;
  cursor?: {
    points: number;
    exact: number;
    predictions: number;
    userId: string;
  };
};

export function LeaderboardExplorer({
  initialRows,
  seasonStartYear,
  leagueCode,
  lifetime,
  weekly = false,
  weekOffset = 0,
  me,
  myWeeklySummary,
}: {
  initialRows: Row[];
  seasonStartYear: number;
  leagueCode?: string;
  lifetime: boolean;
  weekly?: boolean;
  weekOffset?: number;
  me: string | null;
  myWeeklySummary?: { rank: number; points: number } | null;
}) {
  const { t } = useLanguage();
  const [selection, setSelection] = useState<LeaderboardSelection>({
    lifetime,
    weekly,
    weekOffset,
    leagueCode,
  });
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const selectionFromState = useRef<LeaderboardSelection>({
    lifetime, weekly, weekOffset, leagueCode,
  });
  const requestSerial = useRef(0);
  const localCache = useRef(new Map<string, { at: number; rows: Row[] }>());
  useEffect(() => {
    const original = { lifetime, weekly, weekOffset, leagueCode };
    selectionFromState.current = original;
    setSelection(original);
    setRows(initialRows);
  }, [initialRows, lifetime, weekly, weekOffset, leagueCode]);
  async function change(selection: LeaderboardSelection) {
    const previousSelection = { ...selectionFromState.current };
    selectionFromState.current = selection;
    setSelection(selection);
    setError(false);
    const requestId = ++requestSerial.current;
    const query = new URLSearchParams({ limit: "20" });
    if (selection.weekly) {
      query.set("weekly", "true");
      if (selection.weekOffset) query.set("week", "previous");
    } else if (!selection.lifetime) {
      query.set("seasonStartYear", String(seasonStartYear));
    }
    if (selection.leagueCode) query.set("leagueCode", selection.leagueCode);
    const key = query.toString();
    const cached = localCache.current.get(key);
    if (cached && Date.now() - cached.at < 30_000) {
      setRows(cached.rows);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/leaderboards?${key}`);
      if (!response.ok) throw new Error("leaderboard request failed");
      const data = await response.json();
      if (requestSerial.current !== requestId) return;
      const nextRows = (data.rows ?? []) as Row[];
      localCache.current.set(key, { rows: nextRows, at: Date.now() });
      setRows(nextRows);
    } catch {
      if (requestSerial.current === requestId) {
        setError(true);
        selectionFromState.current = previousSelection;
        setSelection(previousSelection);
      }
    } finally {
      if (requestSerial.current === requestId) setLoading(false);
    }
  }
  return (
    <>
      <LeaderboardFilters
        lifetime={selection.lifetime}
        weekly={selection.weekly}
        weekOffset={selection.weekOffset}
        leagueCode={selection.leagueCode}
        onNavigate={change}
        showLeagues={false}
      />
      {selection.weekly && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/[.06] px-4 py-3">
          <p className="text-xs font-medium text-white/80">
            {t(
              "هر هفته رقابت از نو شروع می‌شود. امتیازهای تمام دوران شما محفوظ است.",
              "A fresh competition starts every week. Your lifetime points are always preserved.",
            )}
          </p>
          <Link href="/matches" className="rounded-xl bg-brand px-4 py-2 text-xs font-black text-[#07100b]">
            {t("پیش‌بینی مسابقات", "Predict matches")}
          </Link>
        </div>
      )}
      {selection.weekly && selection.weekOffset === 0 && !selection.leagueCode && myWeeklySummary && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3">
          <p className="text-sm font-semibold text-white">
            {t("رتبه شما در این هفته", "Your rank this week")}: #{myWeeklySummary.rank}
          </p>
          <p className="text-sm font-black text-brand">{myWeeklySummary.points} {t("امتیاز", "points")}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-amber-300">
          {t("دریافت جدول جدید ممکن نشد. لطفاً دوباره تلاش کنید.", "Couldn't refresh the ranking. Please try again.")}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Link
          href={`/lowblock/standings?scope=${selection.weekly ? "weekly" : selection.lifetime ? "lifetime" : "season"}${selection.weekly && selection.weekOffset ? "&week=previous" : ""}`}
          className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-xs font-black text-brand transition hover:bg-brand/20"
        >
          {selection.weekly
            ? t("جدول هفتگی جهانی", "Detailed global weekly table")
            : t("جدول کامل جهانی", "Detailed global table")}
        </Link>
      </div>
      {loading ? (
        <LeaderboardSkeleton />
      ) : (
        <InfiniteLeaderboard
          key={`${selection.weekly ? `weekly:${selection.weekOffset}` : selection.lifetime ? "lifetime" : "season"}:${selection.leagueCode ?? "all"}`}
          initialRows={rows}
          seasonStartYear={seasonStartYear}
          leagueCode={selection.leagueCode}
          lifetime={selection.lifetime}
          weekly={selection.weekly}
          weekOffset={selection.weekOffset}
          me={me}
        />
      )}
    </>
  );
}

function LeaderboardSkeleton() {
  return (
    <section
      aria-label="Loading leaderboard"
      className="mt-8 animate-pulse space-y-4"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-32 rounded-2xl bg-white/[.07]" />
        <div className="h-28 rounded-2xl bg-white/[.05]" />
        <div className="h-28 rounded-2xl bg-white/[.05]" />
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/[.07] bg-[#101512]">
        {Array.from({ length: 7 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-white/[.05] p-4"
          >
            <span className="h-4 w-7 rounded bg-white/[.08]" />
            <span className="h-10 w-10 rounded-full bg-white/[.08]" />
            <span className="h-4 flex-1 rounded bg-white/[.08]" />
            <span className="h-5 w-14 rounded bg-brand/15" />
          </div>
        ))}
      </div>
    </section>
  );
}
