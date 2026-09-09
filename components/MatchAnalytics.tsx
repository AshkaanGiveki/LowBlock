"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Flame,
  GripHorizontal,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { formatNumber } from "@/lib/text";
import { teamName } from "@/lib/football/team-names";
import { LIVE_SCORE_UI_ENABLED } from "@/lib/football/liveScore";

type AnalyticsData = {
  match: any;
  locked: boolean;
  total: number;
  averagePoints: number;
  distribution: Array<{ score: string; count: number }>;
  users: Array<any>;
};

export function MatchAnalytics({
  matchId,
  clubId,
  onClose,
}: {
  matchId: string;
  clubId?: string;
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [visible, setVisible] = useState(true);
  const drawerRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const query = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";
  const number = (value: number | null | undefined) =>
    formatNumber(Number(value ?? 0), language, { maximumFractionDigits: 1 });
  const score = (home: number | null, away: number | null) =>
    home == null || away == null ? "—" : `${number(home)} – ${number(away)}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/matches/${matchId}/analytics${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((next) => {
        if (!cancelled && next) setData(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [matchId, query]);
  useEffect(() => {
    if (
      !LIVE_SCORE_UI_ENABLED ||
      !["LIVE", "SUSPENDED"].includes(String(data?.match.status))
    )
      return;
    const timer = window.setInterval(() => {
      fetch(`/api/matches/${matchId}/analytics${query}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((next) => {
          if (next) setData(next);
        })
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [data?.match.status, matchId, query]);
  const close = () => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  };
  const maxCount = Math.max(
    1,
    ...(data?.distribution ?? []).map((item) => item.count),
  );
  const topPrediction = data?.distribution[0];
  const sortedUsers = useMemo(
    () =>
      [...(data?.users ?? [])].sort(
        (a, b) => Number(b.points ?? -1) - Number(a.points ?? -1),
      ),
    [data?.users],
  );
  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };
  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start === null || !drawerRef.current || drawerRef.current.scrollTop > 2)
      return;
    if ((event.changedTouches[0]?.clientY ?? start) - start > 110) close();
  };
  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-hidden">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-[#020705]/80 backdrop-blur-md"
            aria-label={t("بستن", "Close")}
          />
          <motion.section
            ref={drawerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-t-[2.4rem] border border-b-0 border-brand/20 bg-[#07100c] text-white shadow-[0_-32px_120px_rgba(0,0,0,.8)]"
          >
            <div className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-white/[.06] bg-[#07100c]/85 px-5 backdrop-blur-xl md:px-8">
              <GripHorizontal className="text-white/25" size={27} />
              <button
                type="button"
                onClick={close}
                aria-label={t("بستن", "Close")}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.06] text-white/70 transition hover:border-brand/50 hover:text-brand"
              >
                <X size={17} />
              </button>
            </div>
            {data ? (
              <div className="relative overflow-hidden px-4 pb-10 pt-5 md:px-8 md:pt-7">
                <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-brand/15 blur-3xl" />
                <div className="pointer-events-none absolute -left-40 top-24 h-72 w-72 rounded-full bg-cyan-400/[.07] blur-3xl" />
                <div className="relative grid gap-5 lg:grid-cols-[1.12fr_.88fr]">
                  <MatchHero
                    match={data.match}
                    language={language}
                    number={number}
                    score={score}
                    t={t}
                  />
                  <InsightCard
                    data={data}
                    topPrediction={topPrediction}
                    maxCount={maxCount}
                    number={number}
                    t={t}
                  />
                </div>
                <div className="relative mt-5 grid gap-5 lg:grid-cols-[1.12fr_.88fr]">
                  <Distribution
                    data={data}
                    maxCount={maxCount}
                    number={number}
                    t={t}
                  />
                  <UserPredictions
                    users={sortedUsers}
                    number={number}
                    score={score}
                    t={t}
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 md:p-8">
                <AnalyticsSkeleton />
              </div>
            )}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

function MatchHero({ match, language, number, score, t }: any) {
  const home = teamName(language, match.homeTeam.id, match.homeTeam.name);
  const away = teamName(language, match.awayTeam.id, match.awayTeam.name);
  const finished = ["FINISHED", "FT"].includes(String(match.status));
  const live =
    !finished &&
    (["LIVE", "SUSPENDED"].includes(String(match.status)) ||
      new Date(match.kickoffAt).getTime() <= Date.now());
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-brand/20 bg-[radial-gradient(circle_at_50%_0%,rgba(32,184,121,.22),transparent_58%),linear-gradient(145deg,#123424,#09130e_65%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.1)] md:p-7">
      <div className="flex items-center justify-between text-[10px] font-black tracking-[.18em] text-brand">
        <span className="inline-flex items-center gap-2">
          <BarChart3 size={14} /> {t("تحلیل مسابقه", "MATCH INTELLIGENCE")}
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 tracking-normal text-white/55">
          {match.leagueCode ?? "FOOTBALL"}
        </span>
      </div>
      <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <Team team={match.homeTeam} name={home} />
        <div>
          <div className="text-[2.65rem] font-black leading-none tracking-[-.08em] md:text-5xl">
            {score(match.homeGoals, match.awayGoals)}
          </div>
          <Status
            match={match}
            live={live}
            finished={finished}
            number={number}
          />
        </div>
        <Team team={match.awayTeam} name={away} />
      </div>
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-white/50">
        <CalendarDays size={14} className="text-brand" />{" "}
        {new Date(match.kickoffAt).toLocaleString(
          language === "fa" ? "fa-IR" : "en-GB",
          { dateStyle: "medium", timeStyle: "short" },
        )}
      </div>
    </div>
  );
}
function Team({ team, name }: any) {
  return (
    <div className="min-w-0">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.35rem] border border-white/10 bg-black/20 p-2 shadow-[0_12px_30px_rgba(0,0,0,.2)] md:h-20 md:w-20">
        <Image
          src={team.logoUrl ?? "/icon.png"}
          alt=""
          width={80}
          height={80}
          className="h-full w-full object-contain"
        />
      </div>
      <p className="mt-3 truncate text-sm font-black md:text-base">{name}</p>
    </div>
  );
}
function Status({ match, live, finished, number }: any) {
  if (live)
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-black text-red-200">
        <CircleDot size={11} className="animate-pulse" /> LIVE{" "}
        {match.elapsed != null && `${number(match.elapsed)}′`}
      </div>
    );
  if (finished)
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[10px] font-black text-brand">
        <Check size={11} /> FT
      </div>
    );
  return (
    <div className="mt-3 text-[10px] font-bold text-white/40">
      {match.status}
    </div>
  );
}

function InsightCard({ data, topPrediction, maxCount, number, t }: any) {
  const share = topPrediction
    ? Math.round((topPrediction.count / Math.max(data.total, 1)) * 100)
    : 0;
  return (
    <div className="rounded-[2rem] border border-white/[.08] bg-white/[.035] p-5 md:p-7">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black tracking-[.18em] text-white/40">
            {t("نبض جامعه", "COMMUNITY PULSE")}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            {t("پیش‌بینی‌ها زنده‌اند", "The crowd has spoken")}
          </h2>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Sparkles size={19} />
        </span>
      </div>
      <div className="mt-7 grid grid-cols-3 gap-2">
        <Metric
          icon={<Users size={15} />}
          value={number(data.total)}
          label={t("پیش‌بینی", "PREDICTIONS")}
        />
        <Metric
          icon={<Trophy size={15} />}
          value={data.locked ? number(data.averagePoints) : "—"}
          label={t("میانگین امتیاز", "AVG POINTS")}
        />
        <Metric
          icon={<Flame size={15} />}
          value={`${share}%`}
          label={t("تمرکز اول", "TOP PICK")}
        />
      </div>
      {topPrediction ? (
        <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/[.07] p-4">
          <div className="flex items-center justify-between text-xs text-white/55">
            <span>{t("محبوب‌ترین نتیجه", "Most popular score")}</span>
            <b className="text-brand">
              {number(topPrediction.count)} {t("رأی", "votes")}
            </b>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <strong className="text-3xl font-black">
              {topPrediction.score.replace("-", " – ")}
            </strong>
            <span className="text-xs text-brand">
              {share}% {t("از جامعه", "of the crowd")}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/25">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.min(1, topPrediction.count / maxCount) }}
              style={{ transformOrigin: "left" }}
              className="h-full rounded-full bg-brand"
            />
          </div>
        </div>
      ) : (
        <EmptyState t={t} />
      )}
    </div>
  );
}
function Metric({ icon, value, label }: any) {
  return (
    <div className="rounded-2xl border border-white/[.06] bg-black/15 p-3">
      <span className="text-brand">{icon}</span>
      <b className="mt-1 block text-xl font-black">{value}</b>
      <small className="text-[9px] font-bold tracking-wide text-white/40">
        {label}
      </small>
    </div>
  );
}

function Distribution({ data, maxCount, number, t }: any) {
  return (
    <section className="rounded-[2rem] border border-white/[.08] bg-white/[.035] p-5 md:p-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black tracking-[.18em] text-brand">
            {t("نقشه پیش‌بینی", "PREDICTION MAP")}
          </p>
          <h2 className="mt-2 text-xl font-black">
            {t("توزیع نتایج", "Score distribution")}
          </h2>
        </div>
        <span className="text-xs text-white/35">
          {number(data.total)} {t("پیش‌بینی", "total")}
        </span>
      </div>
      {data.distribution.length ? (
        <div className="mt-6 space-y-3">
          {data.distribution.map((item: any) => (
            <DistributionRow
              key={item.score}
              item={item}
              maxCount={maxCount}
              total={data.total}
            />
          ))}
        </div>
      ) : (
        <EmptyState t={t} />
      )}
    </section>
  );
}
function DistributionRow({ item, maxCount, total }: any) {
  const ratio = item.count / maxCount;
  const percentage = Math.round((item.count / Math.max(total, 1)) * 100);
  return (
    <div className="grid grid-cols-[3.2rem_1fr_2.6rem] items-center gap-3">
      <b className="rounded-xl border border-white/[.07] bg-black/20 px-2 py-2 text-center text-sm">
        {item.score.replace("-", " – ")}
      </b>
      <div className="h-3 overflow-hidden rounded-full bg-white/[.06]">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: ratio }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "left" }}
          className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-300 shadow-[0_0_18px_rgba(32,184,121,.35)]"
        />
      </div>
      <span className="text-end text-xs font-black text-white/55">
        {percentage}%
      </span>
    </div>
  );
}

function UserPredictions({ users, number, score, t }: any) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? users : users.slice(0, 6);
  return (
    <section className="rounded-[2rem] border border-white/[.08] bg-white/[.035] p-5 md:p-7">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black tracking-[.18em] text-brand">
            {t("اتاق رختکن", "THE LOCKER ROOM")}
          </p>
          <h2 className="mt-2 text-xl font-black">
            {t("پیش‌بینی کاربران", "Player predictions")}
          </h2>
        </div>
        <span className="text-xs text-white/35">
          {number(users.length)} {t("بازیکن", "players")}
        </span>
      </div>
      <div className="mt-5 space-y-2">
        {shown.length ? (
          shown.map((user: any, index: number) => (
            <motion.div
              key={`${user.userId ?? user.username}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 6) * 0.04 }}
              className="group flex items-center gap-3 rounded-2xl border border-white/[.05] bg-black/15 px-3 py-2.5 transition hover:border-brand/25 hover:bg-brand/[.05]"
            >
              <UserAvatar
                name={user.username}
                avatarUrl={user.avatarUrl}
                isDefendingChampion={user.isDefendingChampion}
                className="h-9 w-9 text-[10px]"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {user.username}
              </span>
              <span className="rounded-xl border border-brand/20 bg-brand/10 px-2.5 py-1 text-sm font-black text-brand">
                {score(user.homeGoals, user.awayGoals)}
              </span>
              <span className="hidden w-12 text-end text-[10px] font-bold text-white/40 sm:block">
                {user.points == null ? "—" : `${number(user.points)} pts`}
              </span>
            </motion.div>
          ))
        ) : (
          <EmptyState t={t} />
        )}
      </div>
      {users.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-4 inline-flex items-center gap-2 text-xs font-black text-brand"
        >
          {expanded ? t("نمایش کمتر", "Show less") : t("نمایش همه", "Show all")}
          <ChevronDown size={14} className={expanded ? "rotate-180" : ""} />
        </button>
      )}
    </section>
  );
}
function EmptyState({ t }: any) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/35">
      {t("هنوز داده‌ای برای نمایش نیست.", "No data to show yet.")}
    </div>
  );
}
function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-10 w-1/3 rounded-xl bg-white/10" />
      <div className="h-56 rounded-[2rem] bg-white/[.06]" />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="h-72 rounded-[2rem] bg-white/[.06]" />
        <div className="h-72 rounded-[2rem] bg-white/[.06]" />
      </div>
    </div>
  );
}
