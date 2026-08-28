"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Crown, Medal, Sparkles, Trophy } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatNumber } from "@/lib/text";
import { UserAvatar } from "@/components/UserAvatar";

type Row = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isDefendingChampion?: boolean;
  points: number;
  exact: number;
  predictions: number;
  rank: number;
};

export function LeagueStandings({
  rows,
  me,
  leagueCode,
}: {
  rows: Row[];
  me: string | null;
  leagueCode: string;
}) {
  const { language, t } = useLanguage();
  const n = (value: number) => formatNumber(value, language);
  const podium = rows.slice(0, 3);
  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/[.08] bg-[linear-gradient(145deg,#131e17,#0b100d)] shadow-[0_24px_80px_rgba(0,0,0,.24)]">
      <div className="relative overflow-hidden border-b border-white/[.07] p-5 md:p-7">
        <div className="pointer-events-none absolute -top-24 end-0 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-[10px] font-black text-brand">
              <Trophy size={13} />
              {t("جدول امتیازات", "LEAGUE STANDINGS")}
            </div>
            <h2 className="mt-3 text-2xl font-black md:text-3xl">
              {t("رقابت این لیگ", "This league's race")}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t(
                "امتیازها بر اساس پیش‌بینی‌های ثبت‌شده محاسبه می‌شوند.",
                "Rankings are based on canonical scored predictions.",
              )}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-[var(--muted)]">
            {n(rows.length)} {t("بازیکن", "players")}
          </span>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="grid gap-3 p-4 md:grid-cols-3 md:p-6">
            {podium.map((row, index) => (
              <Link
                href={`/u/${encodeURIComponent(row.username)}`}
                key={row.userId}
                className={`group relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-1 ${index === 0 ? "border-[#e8c66a]/35 bg-[#e8c66a]/10 md:-translate-y-2" : "border-white/[.08] bg-white/[.03]"}`}
              >
                <div className="flex items-center gap-3">
                  <UserAvatar name={row.username} avatarUrl={row.avatarUrl} isDefendingChampion={row.isDefendingChampion} className={`h-11 w-11 border-2 ${index === 0 ? "border-[#e8c66a]/60" : "border-white/10"} text-xs`} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{row.username}</b>
                    <small className="text-[10px] text-[var(--muted)]">
                      {n(row.exact)} {t("پیش‌بینی دقیق", "exact picks")}
                    </small>
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-[#e8c66a]">
                    <Medal size={15} />
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <span className="text-xs font-black text-[var(--muted)]">
                    #{n(row.rank)}
                  </span>
                  <strong className="inline-flex items-center gap-1 text-xl text-brand">
                    <Sparkles size={14} />
                    {n(row.points)}
                  </strong>
                </div>
                <ArrowUpRight
                  size={16}
                  className="absolute end-3 top-3 text-white/20 transition group-hover:text-brand"
                />
              </Link>
            ))}
          </div>
          <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-white/[.07] bg-black/15 md:mx-6 md:mb-6">
            <div className="grid grid-cols-[42px_1fr_72px] gap-3 border-b border-white/[.07] px-4 py-3 text-[10px] font-black tracking-wide text-[var(--muted)] md:grid-cols-[56px_1fr_110px_92px]">
              <span>#</span>
              <span>{t("بازیکن", "PLAYER")}</span>
              <span className="hidden md:block">{t("دقت", "ACCURACY")}</span>
              <span className="text-end">{t("امتیاز", "POINTS")}</span>
            </div>
            {rows.map((row, index) => {
              const accuracy = row.predictions
                ? Math.round((row.exact / row.predictions) * 100)
                : 0;
              return (
                <motion.div
                  key={row.userId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 12) * 0.035 }}
                  className={`grid grid-cols-[42px_1fr_72px] items-center gap-3 border-b border-white/[.05] px-4 py-3.5 last:border-0 md:grid-cols-[56px_1fr_110px_92px] ${row.userId === me ? "bg-brand/10" : ""}`}
                >
                  <b
                    className={
                      index < 3 ? "text-[#e8c66a]" : "text-[var(--muted)]"
                    }
                  >
                    {n(row.rank)}
                  </b>
                  <Link
                    href={`/u/${encodeURIComponent(row.username)}`}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <UserAvatar name={row.username} avatarUrl={row.avatarUrl} isDefendingChampion={row.isDefendingChampion} className="h-9 w-9 text-[10px]" />
                    <span className="min-w-0">
                      <b className="block truncate text-sm">
                        {row.username}
                        {row.userId === me && (
                          <span className="ms-2 rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] text-brand">
                            {t("شما", "YOU")}
                          </span>
                        )}
                      </b>
                      <small className="text-[10px] text-[var(--muted)]">
                        {n(row.predictions)} {t("پیش‌بینی", "picks")} ·{" "}
                        {n(row.exact)} {t("دقیق", "exact")}
                      </small>
                    </span>
                  </Link>
                  <div className="hidden md:block">
                    <div className="mb-1 flex justify-between text-[10px] text-[var(--muted)]">
                      <span>{n(accuracy)}٪</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  </div>
                  <b className="text-end text-lg text-brand">{n(row.points)}</b>
                </motion.div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="p-14 text-center">
          <Crown className="mx-auto mb-3 text-brand" size={32} />
          <p className="text-sm text-[var(--muted)]">
            {t(
              "هنوز امتیازی برای این لیگ ثبت نشده است.",
              "No scored predictions in this league yet.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
