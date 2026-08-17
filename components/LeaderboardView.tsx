"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { BarChart3, Crown, Medal, Sparkles, Trophy, Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatNumber } from "@/lib/text";
import { Brand } from "@/components/Brand";

type Row = { userId: string; points: number; predictions: number; exact: number; username: string; avatarUrl: string | null };
type Props = { rows: Row[]; me: string | null; usersCount?: number; picksCount?: number; roundsCount?: number };

export function LeaderboardView({ rows, me, usersCount = rows.length, picksCount = rows.reduce((sum, row) => sum + row.predictions, 0), roundsCount = 0 }: Props) {
  const { language, t } = useLanguage();
  const [visibleCount, setVisibleCount] = useState(10);
  const top = rows[0];
  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const podium = rows.slice(0, 3);
  const number = (value: number) => formatNumber(value, language, { maximumFractionDigits: 1 });

  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-6xl">
    <section className="relative overflow-hidden rounded-[2rem] border border-white/[.08] bg-[radial-gradient(circle_at_15%_15%,rgba(32,184,121,.24),transparent_35%),linear-gradient(145deg,#13231b,#090d0b)] p-6 md:p-10">
      <div className="relative"><div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand"><Crown size={14}/>{t("جدول امتیازات","LEADERBOARD")}</div>
        <h1 className="mt-4 max-w-2xl text-3xl font-black md:text-5xl">{t("رقابت واقعی، رتبه‌بندی شفاف","A real competition, ranked transparently")}</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{t("عملکرد تمام بازیکنان لوبلاک را از اولین پیش‌بینی تا امروز دنبال کنید.","Follow every LowBlock player from their first pick to today.")}</p>
        <div className="mt-7 grid max-w-3xl grid-cols-3 gap-3"><Metric icon={<Users size={16}/>} value={usersCount} label={t("کاربر ثبت‌نام‌شده","Registered users")} language={language}/><Metric icon={<Sparkles size={16}/>} value={picksCount} label={t("پیش‌بینی ثبت‌شده","Submitted picks")} language={language}/><Metric icon={<Trophy size={16}/>} value={roundsCount} label={t("دور برگزارشده","Rounds played")} language={language}/></div>
      </div><Brand variant="stacked" className="pointer-events-none absolute bottom-8 right-10 hidden opacity-60 md:flex"/>
    </section>
    {rows.length ? <>
      <section className="mt-8 grid items-end gap-3 md:grid-cols-3">{podium.map((row, index) => <PodiumCard key={row.userId} row={row} rank={index + 1} language={language} t={t}/>)}</section>
      <section className="mt-7 overflow-hidden rounded-[1.75rem] border border-white/[.08] bg-[#101512] shadow-[0_20px_70px_rgba(0,0,0,.18)]">
        <div className="grid grid-cols-[42px_1fr_86px] items-center gap-3 border-b border-white/[.07] px-4 py-4 text-[10px] font-black tracking-wide text-[var(--muted)] md:grid-cols-[60px_1fr_150px_100px]"><span>#</span><span>{t("بازیکن","PLAYER")}</span><span className="hidden md:block">{t("عملکرد","PERFORMANCE")}</span><span className="text-left">{t("امتیاز","POINTS")}</span></div>
        {visibleRows.map((row, index) => { const accuracy = row.predictions ? Math.round((row.exact / row.predictions) * 100) : 0; return <motion.div key={row.userId} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 9) * .045, type: "spring", stiffness: 360, damping: 28 }} className={`grid grid-cols-[42px_1fr_86px] items-center gap-3 border-b border-white/[.05] px-4 py-4 last:border-0 md:grid-cols-[60px_1fr_150px_100px] ${row.userId === me ? "bg-brand/10" : ""}`}><b className={index < 3 ? "text-[#e8c66a]" : "text-[var(--muted)]"}>{number(index + 1)}</b><div className="flex min-w-0 items-center gap-3"><Avatar row={row}/><div className="min-w-0"><h3 className="truncate text-sm font-black">{row.username}</h3><p className="text-[10px] text-[var(--muted)]">{number(row.predictions)} {t("پیش‌بینی","predictions")} · {number(row.exact)} {t("دقیق","exact")}</p></div></div><div className="hidden md:block"><div className="mb-1 flex justify-between text-[10px] text-[var(--muted)]"><span>{number(accuracy)}%</span><span>{t("دقت","accuracy")}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand" style={{ width: `${accuracy}%` }}/></div></div><b className="text-left text-lg text-brand">{number(row.points)}</b></motion.div> })}
        {visibleCount < rows.length && <div className="flex justify-center border-t border-white/[.06] p-4"><button onClick={() => setVisibleCount((count) => Math.min(count + 10, rows.length))} className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-5 py-3 text-sm font-black text-brand transition hover:bg-brand/20"><BarChart3 size={16}/>{t("نمایش ۱۰ بازیکن بعدی","Load 10 more players")}</button></div>}
      </section>
    </> : <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-14 text-center"><Trophy className="mx-auto mb-4 text-brand" size={36}/><h2 className="font-black">{t("هنوز بازیکنی ثبت نشده است","No players yet")}</h2></div>}
  </div></main>;
}

function Metric({ icon, value, label, language }: { icon: React.ReactNode; value: number; label: string; language: "fa" | "en" }) { return <div className="rounded-2xl border border-white/[.08] bg-black/20 p-3"><span className="text-brand">{icon}</span><AnimatedNumber value={value} language={language}/><small className="block text-[10px] text-[var(--muted)]">{label}</small></div>; }
function AnimatedNumber({ value, language }: { value: number; language: "fa" | "en" }) { const [current, setCurrent] = useState(0); useEffect(() => { const started = performance.now(); const duration = 850; let frame = 0; const tick = (now: number) => { const progress = Math.min((now - started) / duration, 1); setCurrent(Math.round(value * (1 - Math.pow(1 - progress, 3)))); if (progress < 1) frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [value]); return <b className="mt-1 block text-2xl tracking-tight">{formatNumber(current, language)}</b>; }
function PodiumCard({ row, rank, language, t }: { row: Row; rank: number; language: "fa" | "en"; t: (fa: string, en: string) => string }) { const place = formatNumber(rank, language); return <div className={` ${rank === 1 ? "md:pb-8 md:order-2" : rank === 2 ? "md:order-1" : "md:order-3"}`}><div className={`rounded-2xl border p-5 text-center ${rank === 1 ? "border-[#e8c66a]/40 bg-[#e8c66a]/10" : "border-white/[.08] bg-[#111713]"}`}><div className="mb-3 flex items-center justify-center gap-2 text-xs font-black text-[var(--muted)]"><Medal size={15} className={rank === 1 ? "text-[#e8c66a]" : "text-brand"}/>{place}</div><Avatar row={row} large/><h2 className="mt-3 truncate font-black">{row.username}</h2><p className="mt-1 text-xs text-[var(--muted)]">{formatNumber(row.predictions, language)} {t("پیش‌بینی","picks")}</p><div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-sm font-black text-brand"><Sparkles size={14}/>{formatNumber(row.points, language)}</div></div></div>; }
function Avatar({ row, large = false }: { row: Row; large?: boolean }) { return <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-brand/15 font-black ${large ? "mx-auto h-16 w-16 border-white/20 text-lg" : "h-9 w-9 border-white/10 text-[10px]"}`}>{row.avatarUrl ? <img src={row.avatarUrl} alt={row.username} className="h-full w-full object-cover"/> : row.username.slice(0, 2).toUpperCase()}</span>; }
