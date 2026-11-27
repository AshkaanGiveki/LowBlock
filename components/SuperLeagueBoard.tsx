"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSuperLeagueDetailState, selectSuperLeagueWeek } from "@/lib/domain/superLeagueView";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { T } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import H2HHero from "@/components/H2HHero";
import H2HTodayMatches from "@/components/H2HTodayMatches";
import H2HRoundMatches from "@/components/H2HRoundMatches";

function Skeleton() {
  return <div className="mt-6 animate-pulse space-y-5" aria-label="Loading SuperLeague details"><div className="h-20 rounded-[1.35rem] border border-white/[.06] bg-white/[.04]" /><div className="h-72 max-w-5xl rounded-[1.5rem] border border-white/[.06] bg-white/[.04]" /><div className="h-80 max-w-2xl rounded-2xl border border-white/[.06] bg-white/[.04]" /></div>;
}

/**
 * Mobile connections and the first DB query after deployment can briefly
 * fail or exceed a request timeout. Retry only transient failures, never
 * missing authorization or an invalid request.
 */
async function fetchJson(url: string): Promise<any> {
  const backoffMs = [500, 1400];
  let lastError: Error = new Error("SUPERLEAGUE_NETWORK_UNAVAILABLE");
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18_000);
    let retryable = true;
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw new Error(typeof payload.error === "string" ? payload.error : `HTTP_${response.status}`);
      }
      if (!payload || typeof payload !== "object")
        throw new Error("INVALID_SUPERLEAGUE_RESPONSE");
      return payload;
    } catch (reason) {
      lastError = reason instanceof Error ? reason : new Error("SUPERLEAGUE_NETWORK_UNAVAILABLE");
      if (!retryable || attempt === backoffMs.length) throw lastError;
    } finally {
      window.clearTimeout(timeout);
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, backoffMs[attempt]));
  }
  throw lastError;
}

function StatusCard({
  kind,
  onRetry,
}: {
  kind: "unavailable" | "preparing" | "no-group";
  onRetry: () => void;
}) {
  const isFailure = kind === "unavailable";
  return (
    <section
      className="mt-6 max-w-5xl rounded-2xl border border-white/[.08] bg-[#101713] px-5 py-6"
      role={isFailure ? "alert" : "status"}
    >
      <p className="text-sm font-bold text-white/85">
        {kind === "preparing" ? (
          <T fa="گروه سوپرلیگ این هفته در حال آماده‌سازی است" en="This week's SuperLeague is being prepared" />
        ) : kind === "no-group" ? (
          <T fa="برای این هفته گروهی ثبت نشده است" en="There is no SuperLeague group for this week" />
        ) : (
          <T fa="در حال حاضر دریافت جزئیات ممکن نیست" en="SuperLeague details are temporarily unavailable" />
        )}
      </p>
      <p className="mt-2 text-xs leading-6 text-white/55">
        {isFailure ? (
          <T fa="ارتباط برقرار نشد. اطلاعات قبلی محفوظ است؛ دوباره تلاش کنید."
             en="The connection failed. Your saved predictions are unaffected; try refreshing." />
        ) : kind === "preparing" ? (
          <T fa="به‌محض انتشار گروه و مسابقات، این بخش به‌صورت خودکار به‌روزرسانی می‌شود."
             en="The group and fixtures will appear automatically once published." />
        ) : (
          <T fa="می‌توانید هفته دیگری را انتخاب کنید." en="You can browse another SuperLeague week." />
        )}
      </p>
      {kind !== "no-group" && (
        <button type="button" onClick={onRetry}
          className="mt-4 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-xs font-black text-brand transition hover:bg-brand/20">
          {isFailure ? <T fa="تلاش دوباره" en="Retry" /> : <T fa="بررسی مجدد" en="Check again" />}
        </button>
      )}
    </section>
  );
}

function preferredRoundIndex(slates: any[] = []) {
  const upcoming = slates.find((item) => {
    const kickoffs = (item.fixtures ?? []).map((fixture: any) => new Date(fixture.kickoffAt).getTime()).filter(Number.isFinite);
    const latestKickoff = kickoffs.length ? Math.max(...kickoffs) : new Date(item.firstKickoffAt).getTime();
    return latestKickoff > Date.now();
  });
  if (upcoming) return Math.max(0, Number(upcoming.matchday) - 1);
  return slates.length ? Math.max(0, Number(slates[slates.length - 1].matchday) - 1) : 0;
}

function Standings({ rows, viewerId }: { rows: any[]; viewerId: string }) {
  return <section className="mt-8 max-w-3xl overflow-hidden rounded-2xl border border-white/[.08] bg-[#101512]"><div className="flex items-center gap-2 border-b border-white/[.07] px-3 py-3 text-brand sm:px-4"><Crown size={14} /><h2 className="text-sm font-black"><T fa="جدول رتبه‌بندی" en="Standings" /></h2></div><div className="grid grid-cols-[22px_minmax(0,1fr)_32px_32px_32px_48px_48px] items-center gap-2 border-b border-white/[.06] px-3 py-2 text-[8px] font-black uppercase tracking-[.12em] text-white/30 sm:grid-cols-[26px_minmax(0,1fr)_38px_38px_38px_58px_58px] sm:px-4"><span>#</span><span><T fa="بازیکن" en="Player" /></span><span className="text-center">W</span><span className="text-center">D</span><span className="text-center">L</span><span className="text-center">PTS</span><span className="text-center">PRD</span></div><div className="divide-y divide-white/[.05]">{rows.map((row: any) => <div key={row.userId} className={`grid grid-cols-[22px_minmax(0,1fr)_32px_32px_32px_48px_48px] items-center gap-2 px-3 py-2 sm:grid-cols-[26px_minmax(0,1fr)_38px_38px_38px_58px_58px] sm:px-4 ${row.userId === viewerId ? "bg-brand/[.07]" : ""}`}><span className="text-xs font-black text-brand">{row.rank}</span><div className="flex min-w-0 items-center gap-2"><UserAvatar name={row.username} avatarUrl={row.avatarUrl} className="h-7 w-7 shrink-0 text-[8px]" /><span className="truncate text-[10px] font-bold text-white/80 sm:text-[11px]">{row.username}</span></div><span className="text-center text-[10px] font-bold text-white/70">{row.wins ?? 0}</span><span className="text-center text-[10px] font-bold text-white/50">{row.draws ?? 0}</span><span className="text-center text-[10px] font-bold text-white/50">{row.losses ?? 0}</span><span className="justify-self-center rounded-lg bg-brand/15 px-2 py-1 text-[11px] font-black text-brand">{row.h2hPoints ?? 0}</span><span className="justify-self-center rounded-lg bg-white/[.06] px-2 py-1 text-[11px] font-black text-white/75">{row.predictionPoints ?? 0}</span></div>)}</div></section>;
}

export default function SuperLeagueBoard() {
  const [data, setData] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [weekIndex, setWeekIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [detailFailed, setDetailFailed] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const cache = useRef(new Map<string, { value: any; at: number }>());
  const selectedWeekRef = useRef("");
  const detailRequestRef = useRef(0);
  const overviewRequestRef = useRef(0);

  const loadDetail = useCallback(async (
    weekKey: string,
    options: { force?: boolean; quiet?: boolean } = {},
  ) => {
    if (!weekKey) return;
    const requestId = ++detailRequestRef.current;
    const cached = cache.current.get(weekKey);
    if (!options.force && cached && Date.now() - cached.at < 45_000) {
      setDetail(cached.value);
      setDetailFailed(false);
      setLoading(false);
      if (!options.quiet)
        setRoundIndex(preferredRoundIndex(cached.value.league?.slates ?? []));
      return;
    }
    if (!options.quiet && !cached) {
      setDetail(null);
      setLoading(true);
    } else if (cached) {
      setDetail(cached.value);
    }
    if (!options.quiet) setDetailFailed(false);
    try {
      const response = await fetchJson(`/api/superleague/week/${encodeURIComponent(weekKey)}`);
      if (requestId !== detailRequestRef.current) return;
      if (!("league" in response)) throw new Error("INVALID_SUPERLEAGUE_DETAIL_RESPONSE");
      cache.current.set(weekKey, { value: response, at: Date.now() });
      setDetail(response);
      setDetailFailed(false);
      if (!options.quiet)
        setRoundIndex(preferredRoundIndex(response.league?.slates ?? []));
    } catch (reason) {
      if (requestId !== detailRequestRef.current) return;
      // Retain a previous good snapshot rather than blanking the whole page
      // during a transient API/database failure.
      if (cached) setDetail(cached.value);
      else {
        setDetail(null);
        setDetailFailed(true);
        console.warn("SuperLeague details request failed", reason);
      }
    } finally {
      if (requestId === detailRequestRef.current) setLoading(false);
    }
  }, []);

  const refreshOverview = useCallback(async (quiet = false) => {
    const requestId = ++overviewRequestRef.current;
    if (!quiet) {
      setOverviewLoading(true);
      setOverviewFailed(false);
    }
    try {
      const next = await fetchJson("/api/h2h/current");
      if (requestId !== overviewRequestRef.current) return;
      setData(next);
      setOverviewFailed(false);
      const selection = selectSuperLeagueWeek(
        next.availableWeeks ?? (next.league?.weekKey ? [next.league.weekKey] : []),
        next.weekKey ?? "",
        selectedWeekRef.current,
      );
      selectedWeekRef.current = selection.selected;
      setWeekIndex(selection.index);
      // Historical weeks are immutable: avoid refetching their full pairings
      // on every poll. Only the current week needs background updates.
      if (next.enabled && next.reason !== "NO_CLUB" && selection.selected &&
          (!quiet || selection.selected === next.weekKey))
        void loadDetail(selection.selected, { force: quiet, quiet });
    } catch (reason) {
      if (requestId !== overviewRequestRef.current) return;
      if (!quiet) {
        setOverviewFailed(true);
        console.warn("SuperLeague overview request failed", reason);
      }
    } finally {
      if (requestId === overviewRequestRef.current) setOverviewLoading(false);
    }
  }, [loadDetail]);

  useEffect(() => {
    void refreshOverview();
    return () => {
      // Ignore responses from a page that has been left.
      overviewRequestRef.current++;
      detailRequestRef.current++;
    };
  }, [refreshOverview]);

  useEffect(() => {
    if (!data?.enabled || data.reason === "NO_CLUB") return;
    // The Friday noon transition and new fixture publications must become
    // visible without a manual page refresh.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void refreshOverview(true);
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [data?.enabled, data?.reason, refreshOverview]);

  const wrapper = "min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32";
  if (!data && overviewLoading)
    return <main className={wrapper}><div className="mx-auto max-w-7xl">
      <H2HHero slateCount={7} activeSlate={1} progressSlate={1} />
      <Skeleton />
    </div></main>;

  if (!data)
    return <main className={wrapper}><div className="mx-auto max-w-7xl">
      <H2HHero slateCount={7} activeSlate={1} progressSlate={1} />
      <StatusCard kind="unavailable" onRetry={() => void refreshOverview()} />
    </div></main>;

  if (!data.enabled)
    return <main className={wrapper}><div className="mx-auto max-w-7xl">
      <H2HHero slateCount={7} activeSlate={1} progressSlate={1} />
      <StatusCard kind="no-group" onRetry={() => void refreshOverview()} />
    </div></main>;

  const weekKeys = selectSuperLeagueWeek(
    data.availableWeeks ?? (data.league?.weekKey ? [data.league.weekKey] : []),
    data.weekKey ?? "",
  ).weeks;
  if (data.reason === "NO_CLUB")
    return <main className={wrapper}><div className="mx-auto max-w-7xl">
      <H2HHero slateCount={7} activeSlate={1} progressSlate={1} />
      <p className="mt-6 max-w-2xl rounded-2xl border border-white/[.08] bg-[#101713] p-5 text-sm text-white/60">
        <T fa="برای ورود به سوپرلیگ به یک باشگاه بپیوندید." en="Join a club to enter SuperLeague." />
      </p>
    </div></main>;

  const selectedIndex = Math.max(0, Math.min(weekIndex, weekKeys.length - 1));
  const selectedWeek = weekKeys[selectedIndex] ?? data.weekKey ?? "";
  const league = detail?.league;
  const state = getSuperLeagueDetailState({
    loading, failed: detailFailed || overviewFailed, league,
    selectedWeek, currentWeek: data.weekKey ?? "",
  });
  const activeMatchday = roundIndex + 1;
  const round = league?.h2hMatches?.find((item: any) => item.matchday === activeMatchday);
  const slate = league?.slates?.find((item: any) => item.matchday === activeMatchday);
  const viewerIncluded = detail?.viewerIncluded ?? (
    selectedWeek === data.weekKey && data.viewerIncluded === true
  );

  const moveWeek = (direction: number) => {
    const next = Math.min(weekKeys.length - 1, Math.max(0, selectedIndex + direction));
    if (next === selectedIndex) return;
    const newWeek = weekKeys[next];
    selectedWeekRef.current = newWeek;
    ++detailRequestRef.current;
    setWeekIndex(next);
    setRoundIndex(0);
    setDetail(null);
    setDetailFailed(false);
    void loadDetail(newWeek);
  };

  return <main className={wrapper}>
    <div className="mx-auto max-w-7xl">
      <H2HHero slateCount={7} activeSlate={activeMatchday} progressSlate={activeMatchday} />

      <section dir="ltr" className="mt-6 flex items-center justify-between rounded-[1.35rem] border border-white/[.08] bg-[#101713] px-3 py-3.5 shadow-[0_16px_50px_rgba(0,0,0,.16)] md:px-5">
        <button type="button" onClick={() => moveWeek(-1)} disabled={selectedIndex <= 0}
          aria-label="Previous SuperLeague week"
          className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-brand">
            <T fa="هفته سوپرلیگ" en="SUPERLEAGUE WEEK" />
          </p>
          <h2 className="mt-0.5 text-xl font-black">
            <T fa="هفته" en="Week" /> {selectedIndex + 1}
          </h2>
          <p className="mt-0.5 text-[10px] text-white/35">{selectedWeek}</p>
        </div>
        <button type="button" onClick={() => moveWeek(1)}
          disabled={selectedIndex >= weekKeys.length - 1}
          aria-label="Next SuperLeague week"
          className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25">
          <ChevronRight size={20} />
        </button>
      </section>

      {state === "loading" && <Skeleton />}
      {state === "unavailable" && (
        <StatusCard kind="unavailable" onRetry={() => void loadDetail(selectedWeek, { force: true })} />
      )}
      {state === "preparing" && (
        <StatusCard kind="preparing" onRetry={() => void refreshOverview()} />
      )}
      {state === "no-group" && (
        <StatusCard kind="no-group" onRetry={() => void refreshOverview()} />
      )}

      {state === "ready" && (
        <>
          {viewerIncluded && (
            <H2HTodayMatches slates={league.slates ?? []} leagueId={league.id} matchday={activeMatchday} />
          )}
          <section dir="ltr" className="mt-3 flex items-center justify-between rounded-2xl border border-white/[.06] bg-white/[.02] px-3 py-2">
            <button type="button" onClick={() => setRoundIndex((index) => Math.max(0, index - 1))}
              disabled={roundIndex <= 0} aria-label="Previous round"
              className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:bg-white/[.06] disabled:opacity-20">
              <ChevronLeft size={17} />
            </button>
            <span className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">
              Round {activeMatchday}{slate?.sourceDate ? ` · ${slate.sourceDate}` : ""}
            </span>
            <button type="button" onClick={() => setRoundIndex((index) => Math.min(6, index + 1))}
              disabled={roundIndex >= 6} aria-label="Next round"
              className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:bg-white/[.06] disabled:opacity-20">
              <ChevronRight size={17} />
            </button>
          </section>
          {round ? <H2HRoundMatches round={round} /> : (
            <p className="mt-5 max-w-5xl rounded-2xl border border-white/[.07] bg-white/[.025] p-5 text-sm text-white/60">
              <T fa="مسابقات این دور پس از انتشار برنامه نمایش داده می‌شوند."
                 en="This round's matchups will appear after the slate is published." />
            </p>
          )}
          {Array.isArray(league.standings) ? (
            <Standings rows={league.standings} viewerId={league.viewerId} />
          ) : (
            <p className="mt-6 text-sm text-white/55">
              <T fa="جدول در حال آماده‌سازی است." en="Standings are being prepared." />
            </p>
          )}
        </>
      )}
    </div>
  </main>;
}
