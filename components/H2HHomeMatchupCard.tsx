"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Swords } from "lucide-react";
import { T, useLanguage } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { formatNumber } from "@/lib/text";

type H2HTodayMatch = {
  matchday: number;
  startsAt: string;
  player: { username: string; avatarUrl: string | null };
  opponent: { username: string; avatarUrl: string | null };
};

function timerParts(milliseconds: number, language: "fa" | "en") {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    [days, language === "fa" ? "روز" : "D"],
    [hours, language === "fa" ? "ساعت" : "H"],
    [minutes, language === "fa" ? "دقیقه" : "M"],
    [seconds, language === "fa" ? "ثانیه" : "S"],
  ].map(([value, label]) => ({ value: formatNumber(value as number, language, { minimumIntegerDigits: 2, useGrouping: false }), label }));
}

export default function H2HHomeMatchupCard({ match }: { match: H2HTodayMatch }) {
  const { language } = useLanguage();
  const [now, setNow] = useState(Date.now());
  const startsAt = new Date(match.startsAt).getTime();
  const remaining = startsAt - now;
  const started = remaining <= 0;
  const timer = useMemo(() => timerParts(remaining, language), [remaining, language]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="relative mb-5 overflow-hidden rounded-[1.6rem] border border-brand/25 bg-[#0e1d15] shadow-[0_20px_60px_rgba(0,0,0,.2)]">
      <div className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 start-1/3 h-40 w-40 rounded-full bg-emerald-950/70 blur-3xl" />
      <Link href="/h2h" className="group relative block p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.2em] text-brand"><T fa="نبرد امروز H2H" en="TODAY'S H2H DUEL" /></p>
            <p className="mt-1 text-[10px] font-semibold text-white/45"><T fa={`اسلیت ${match.matchday}`} en={`Slate ${match.matchday}`} /></p>
          </div>
          <span className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-brand"><T fa="ورود به H2H" en="OPEN H2H" /></span>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 text-center">
            <UserAvatar name={match.player.username} avatarUrl={match.player.avatarUrl} className="mx-auto h-14 w-14 border-2 border-brand/60 text-xs shadow-[0_0_24px_rgba(32,184,121,.2)]" />
            <p className="mt-2 truncate text-sm font-black text-white">{match.player.username}</p>
          </div>
          <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-brand/35 bg-[#092216] text-brand shadow-[0_0_26px_rgba(32,184,121,.18)]">
            <span className="absolute inset-1 rounded-xl border border-brand/15" />
            <Swords size={24} strokeWidth={2.1} />
          </div>
          <div className="min-w-0 text-center">
            <UserAvatar name={match.opponent.username} avatarUrl={match.opponent.avatarUrl} className="mx-auto h-14 w-14 border-2 border-white/20 text-xs" />
            <p className="mt-2 truncate text-sm font-black text-white/85">{match.opponent.username}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/[.09] bg-black/15 px-3 py-3">
          <div className="mb-2 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-[.18em] text-white/45">
            <Clock3 size={12} className={started ? "text-brand" : "text-brand/80"} />
            <T fa={started ? "نبرد آغاز شده" : "شروع نبرد در"} en={started ? "DUEL IS LIVE" : "DUEL STARTS IN"} />
          </div>
          {started ? <div className="text-center text-sm font-black text-brand"><T fa="اکنون در جریان است" en="Live now" /></div> : <div className="grid grid-cols-4 divide-x divide-white/10 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.035]">{timer.map((unit) => <div key={unit.label} className="px-1 py-2 text-center"><div className="text-lg font-light leading-none tabular-nums text-white">{unit.value}</div><div className="mt-1 text-[8px] font-bold uppercase tracking-[.12em] text-white/40">{unit.label}</div></div>)}</div>}
        </div>
      </Link>
    </section>
  );
}
