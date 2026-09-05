"use client";

import { useEffect, useRef, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Check, GripHorizontal, Radio, Trophy, Users, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatNumber } from "@/lib/text";
import { teamName } from "@/lib/football/team-names";
import { UserAvatar } from "@/components/UserAvatar";

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
  const [data, setData] = useState<any>(null);
  const [visible, setVisible] = useState(true);
  const drawerRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const number = (value: number) =>
    formatNumber(value, language, { maximumFractionDigits: 1 });
  const score = (home: number | null, away: number | null) =>
    home === null || away === null ? "—" : `${number(home)} - ${number(away)}`;
  useEffect(() => {
    const query = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";
    fetch(`/api/matches/${matchId}/analytics${query}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [matchId, clubId]);
  useEffect(() => {
    if (data?.match.status !== "LIVE" && data?.match.status !== "SUSPENDED") return;
    const timer = window.setInterval(() => {
      const query = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";
      fetch(`/api/matches/${matchId}/analytics${query}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((next) => { if (next) setData(next); }).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [data?.match.status, matchId, clubId]);
  const close = () => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  };
  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };
  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start === null || !drawerRef.current || drawerRef.current.scrollTop > 2)
      return;
    const distance = (event.changedTouches[0]?.clientY ?? start) - start;
    if (distance > 110) close();
  };
  const options = data
    ? {
        chart: {
          type: "bar",
          backgroundColor: "transparent",
          height: 250,
          animation: { duration: 700 },
        },
        title: { text: undefined },
        xAxis: {
          categories: data.distribution.map((item: any) =>
            String(item.score)
              .split("-")
              .map((part: string) => number(Number(part)))
              .join(" - "),
          ),
          lineColor: "transparent",
          tickColor: "transparent",
          labels: {
            style: {
              color: "#c5d0ca",
              fontFamily: "IranSans",
              fontSize: "11px",
            },
          },
        },
        yAxis: {
          title: { text: undefined },
          allowDecimals: false,
          gridLineColor: "rgba(255,255,255,.06)",
          labels: {
            formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
              return formatNumber(Number(this.value), language);
            },
            style: { color: "#98a59e", fontFamily: "IranSans" },
          },
        },
        plotOptions: {
          series: {
            animation: { duration: 850 },
            borderWidth: 0,
            borderRadius: 6,
            pointPadding: 0.16,
            groupPadding: 0.08,
          },
        },
        legend: { enabled: false },
        credits: { enabled: false },
        series: [
          {
            name: t("تعداد", "Count"),
            data: data.distribution.map((item: any) => item.count),
            color: "#20b879",
          },
        ],
        tooltip: {
          backgroundColor: "#111713",
          borderWidth: 0,
          borderRadius: 12,
          style: { color: "#fff", fontFamily: "IranSans" },
          formatter(this: any) {
            return `<b>${this.x}</b><br/>${formatNumber(Number(this.y), language)} ${t("پیش‌بینی", "predictions")}`;
          },
        },
      }
    : null;
  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-hidden">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            aria-label={t("بستن", "Close")}
          />
          <motion.section
            ref={drawerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 28,
              mass: 0.8,
            }}
            className="scrollbar-thin relative max-h-[90vh] w-full max-w-none overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-[2rem] border border-b-0 border-white/10 bg-[linear-gradient(145deg,#14231b,#0b100d)] px-5 pb-8 pt-16 shadow-2xl md:px-8 md:pt-[4.5rem]"
          >
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 text-white/25">
              <GripHorizontal size={28} />
            </div>
            <button
              onClick={close}
              className="absolute left-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[.07] text-white/80 shadow-lg transition hover:border-brand/50 hover:bg-brand/15 hover:text-brand"
              aria-label={t("بستن", "Close")}
            >
              <X size={19} />
            </button>
            {data ? (
              <>
                <div className="flex items-center gap-3">
                  <Crest team={data.match.homeTeam} />
                  <div className="min-w-0 flex-1 text-center">
                    <p className="inline-flex items-center gap-1 text-[10px] font-black tracking-[.2em] text-brand">
                      <BarChart3 size={14} />
                      {t("تحلیل مسابقه", "MATCH ANALYTICS")}
                    </p>
                    <h2 className="mt-2 truncate text-lg font-black md:text-xl">
                      {teamName(
                        language,
                        data.match.homeTeam.id,
                        data.match.homeTeam.name,
                      )}{" "}
                      <span className="mx-1 text-brand">·</span>{" "}
                      {teamName(
                        language,
                        data.match.awayTeam.id,
                        data.match.awayTeam.name,
                      )}
                    </h2>
                    <AnalyticsStatus match={data.match} language={language} />
                  </div>
                  <Crest team={data.match.awayTeam} />
                </div>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <Stat
                    icon={<Users size={15} />}
                    value={number(data.total)}
                    label={t("پیش‌بینی", "predictions")}
                  />
                  <Stat
                    icon={<Trophy size={15} />}
                    value={number(data.averagePoints)}
                    label={t("میانگین امتیاز", "average points")}
                  />
                  <Stat
                    icon={<Trophy size={15} />}
                    value={score(data.match.homeGoals, data.match.awayGoals)}
                    label={t("نتیجه زنده", data.match.status === "LIVE" ? "live score" : "final result")}
                  />
                </div>
                <div className="mt-5 rounded-2xl border border-white/[.06] bg-black/20 p-4">
                  <h3 className="mb-2 text-sm font-black">
                    {t(
                      "توزیع نتایج پیش‌بینی‌شده",
                      "Predicted score distribution",
                    )}
                  </h3>
                  {options && (
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={options}
                    />
                  )}
                </div>
                <div className="mt-6 space-y-2">
                  <h3 className="text-sm font-black">
                    {t("پیش‌بینی کاربران", "User predictions")}
                  </h3>
                  {data.users.map((user: any, index: number) => (
                    <motion.div
                      key={`${user.username}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.045 }}
                      className="flex items-center gap-3 rounded-2xl border border-white/[.05] bg-black/20 px-3 py-3"
                    >
                      <UserAvatar name={user.username} avatarUrl={user.avatarUrl} isDefendingChampion={user.isDefendingChampion} className="h-9 w-9 text-[10px]" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {user.username}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {number(user.points)} {t("امتیاز", "pts")}
                      </span>
                      <b className="text-brand">
                        {score(user.homeGoals, user.awayGoals)}
                      </b>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <AnalyticsSkeleton />
            )}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

function AnalyticsStatus({ match, language }: { match: any; language: "fa" | "en" }) {
  const kickoff = new Date(match.kickoffAt).getTime();
  const started = match.status === "LIVE" || match.status === "SUSPENDED" || (match.status === "SCHEDULED" && kickoff <= Date.now());
  const finished = match.status === "FINISHED" || match.status === "FT";
  const score = match.homeGoals != null && match.awayGoals != null ? `${formatNumber(match.homeGoals, language)} - ${formatNumber(match.awayGoals, language)}` : "—";
  const minute = match.elapsed ?? Math.max(1, Math.floor((Date.now() - kickoff) / 60_000));
  if (started && !finished) return <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-red-100 shadow-[0_0_24px_rgba(248,113,113,.12)]"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" /></span><b className="tracking-[.12em]">LIVE</b><strong className="text-sm text-white">{score}</strong><small className="rounded-md bg-white/10 px-1.5 py-0.5 font-black">{formatNumber(minute, language)}′</small></div>;
  if (finished) return <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-brand shadow-[0_0_24px_rgba(32,184,121,.1)]"><span className="grid h-4 w-4 place-items-center rounded-full bg-brand/20"><Check size={10} /></span><b>FT</b><strong className="text-sm text-white">{score}</strong></div>;
  return null;
}

function Crest({ team }: { team: any }) {
  return (
    <img
      src={team.logoUrl ?? "/icon.png"}
      alt=""
      className="h-12 w-12 object-contain"
    />
  );
}
function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[.05] bg-black/20 p-3">
      <span className="text-brand">{icon}</span>
      <b className="mt-1 block text-lg">{value}</b>
      <small className="text-[10px] text-[var(--muted)]">{label}</small>
    </div>
  );
}
function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="mx-auto h-7 w-2/3 rounded bg-white/10" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-20 rounded-2xl bg-white/10" />
        <div className="h-20 rounded-2xl bg-white/10" />
        <div className="h-20 rounded-2xl bg-white/10" />
      </div>
      <div className="h-64 rounded-2xl bg-white/10" />
      <div className="h-14 rounded-2xl bg-white/10" />
      <div className="h-14 rounded-2xl bg-white/10" />
    </div>
  );
}
