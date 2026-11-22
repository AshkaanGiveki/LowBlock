"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DesktopHomeDashboard } from "@/components/DesktopHomeDashboard";
import H2HHomeMatchupCard from "@/components/H2HHomeMatchupCard";
import { HomeFixtureSlider } from "@/components/HomeFixtureSlider";
import { MatchEmptyState } from "@/components/MatchEmptyState";
import { T } from "@/components/LanguageProvider";

type HomeData = Pick<
  React.ComponentProps<typeof DesktopHomeDashboard>,
  | "matches"
  | "predictions"
  | "allPredicted"
  | "rows"
  | "username"
  | "rank"
  | "points"
  | "exact"
  | "clubName"
> & {
  h2hTodayMatch:
    React.ComponentProps<typeof H2HHomeMatchupCard>["match"] | null;
};
const fallback: HomeData = {
  matches: [],
  predictions: {},
  allPredicted: false,
  rows: [],
  username: "",
  rank: "—",
  points: 0,
  exact: 0,
  clubName: null,
  h2hTodayMatch: null,
};

export default function HomeLiveData() {
  const [data, setData] = useState<HomeData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch("/api/home?fixturesOnly=1", {
        cache: "no-store",
        signal: signal ?? AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error("Home feed unavailable");
      const next = await response.json();
      if (!Array.isArray(next.matches)) throw new Error("Invalid home feed");
      setData((current) => ({
        ...next,
        ...(current
          ? {
              username: current.username,
              rank: current.rank,
              points: current.points,
              exact: current.exact,
              clubName: current.clubName,
              rows: current.rows,
              h2hTodayMatch: current.h2hTodayMatch,
            }
          : {}),
      }));
      setError(false);
    } catch {
      if (!signal?.aborted) setError(true);
    } finally {
      inFlight.current = false;
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    // Rankings and club data load independently of the fixture request.
    fetch("/api/home", {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((next) => {
        if (!next || !Array.isArray(next.matches)) return;
        const { matches, predictions, allPredicted, ...dashboard } = next;
        setData((current) => ({ ...(current ?? next), ...dashboard }));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const value = data ?? fallback;
  const fixtureContent =
    !data && loading ? (
      <div
        className="mt-4 h-72 w-full animate-pulse rounded-[1.75rem] border border-white/[.08] bg-white/[.04] motion-reduce:animate-none"
        role="status"
      >
        <span className="sr-only">
          <T fa="در حال بارگیری مسابقه‌ها" en="Loading fixtures" />
        </span>
      </div>
    ) : !data && error ? (
      <MatchEmptyState
        variant="error"
        compact
        onAction={() => void load()}
        busy={loading}
      />
    ) : undefined;
  return (
    <>
      <div className="mt-6 min-h-24">
        <DesktopHomeDashboard {...value} fixtureContent={fixtureContent} />
      </div>
      {value.h2hTodayMatch && (
        <H2HHomeMatchupCard match={value.h2hTodayMatch} />
      )}
      <section className="home-upcoming-section mt-8 pb-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[.16em] text-brand">
              <T fa="مسابقه‌های پیش‌رو" en="UPCOMING MATCHES" />
            </p>
            <h2 className="mt-2 text-2xl font-black">
              <T fa="فرصت بعدی برای پیش‌بینی" en="Your next predictions" />
            </h2>
          </div>
          <Link
            href="/matches?tab=open"
            className="shrink-0 text-xs font-bold text-brand"
          >
            <T fa="همه مسابقه‌ها" en="All matches" />
          </Link>
        </div>
        {fixtureContent ?? (
          <HomeFixtureSlider
            layout="grid"
            matches={value.matches}
            predictions={value.predictions}
            allPredicted={value.allPredicted}
          />
        )}
      </section>
    </>
  );
}
