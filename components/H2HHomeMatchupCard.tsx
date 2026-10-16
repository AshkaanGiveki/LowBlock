"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, Swords } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { formatNumber } from "@/lib/text";

type H2HTodayMatch = {
  matchday: number;
  startsAt: string;
  player: { username: string; avatarUrl: string | null };
  opponent: { username: string; avatarUrl: string | null };
};

function formatCountdown(milliseconds: number, language: "fa" | "en") {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const part = (value: number) => formatNumber(value, language, { minimumIntegerDigits: 2, useGrouping: false });
  return `${days > 0 ? `${formatNumber(days, language, { useGrouping: false })}:` : ""}${part(hours)}:${part(minutes)}:${part(seconds)}`;
}

export default function H2HHomeMatchupCard({ match }: { match: H2HTodayMatch }) {
  const { language } = useLanguage();
  const [now, setNow] = useState(Date.now());
  const remaining = new Date(match.startsAt).getTime() - now;
  const started = remaining <= 0;
  const timer = formatCountdown(remaining, language);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="relative mt-9 mb-5 overflow-visible rounded-2xl border border-brand/25 bg-[#0e1d15] shadow-[0_18px_48px_rgba(0,0,0,.2)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -end-12 -top-16 h-40 w-40 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -bottom-20 start-1/3 h-32 w-32 rounded-full bg-emerald-950/80 blur-3xl" />
      </div>

      <Link href="/h2h" dir="ltr" className="group relative block">
        <div className="absolute left-1/2 top-0 z-20 flex h-[54px] min-w-[184px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-brand/50 bg-[#091a12]/[.98] px-4 shadow-[0_10px_28px_rgba(0,0,0,.32),0_0_26px_rgba(32,184,121,.16)]">
          <span className="pointer-events-none absolute inset-1 rounded-xl border border-brand/15" />
          <span className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand/80 to-transparent" />
          <Clock3 size={15} className={started ? "relative text-brand" : "relative text-brand/85"} />
          <span className="relative text-base font-black tracking-[.08em] tabular-nums text-white">{started ? "LIVE" : timer}</span>
          <span className={`relative h-1.5 w-1.5 rounded-full ${started ? "bg-brand shadow-[0_0_10px_rgba(32,184,121,.9)]" : "bg-brand/60"}`} />
        </div>

        <div className="relative grid min-h-[108px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 pb-3 pt-10 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar name={match.player.username} avatarUrl={match.player.avatarUrl} className="h-11 w-11 shrink-0 border-2 border-brand/65 text-xs shadow-[0_0_22px_rgba(32,184,121,.2)]" />
            <p dir="auto" title={match.player.username} className="min-w-0 truncate text-sm font-black text-white">{match.player.username}</p>
          </div>

          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand/40 bg-[#092216] text-brand shadow-[0_0_22px_rgba(32,184,121,.18)]">
            <span className="absolute inset-1 rounded-xl border border-brand/15" />
            <Swords size={22} strokeWidth={2.1} />
          </div>

          <div className="flex min-w-0 items-center justify-end gap-3">
            <p dir="auto" title={match.opponent.username} className="min-w-0 truncate text-right text-sm font-black text-white/85">{match.opponent.username}</p>
            <UserAvatar name={match.opponent.username} avatarUrl={match.opponent.avatarUrl} className="h-11 w-11 shrink-0 border-2 border-white/25 text-xs" />
          </div>
        </div>
      </Link>
    </section>
  );
}
