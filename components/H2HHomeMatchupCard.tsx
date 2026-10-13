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
  const startsAt = new Date(match.startsAt).getTime();
  const remaining = startsAt - now;
  const started = remaining <= 0;
  const timer = formatCountdown(remaining, language);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="relative mb-5 overflow-hidden rounded-2xl border border-brand/25 bg-[#0e1d15] shadow-[0_12px_36px_rgba(0,0,0,.16)]">
      <div className="pointer-events-none absolute -end-12 -top-16 h-32 w-32 rounded-full bg-brand/20 blur-3xl" />
      <Link href="/h2h" dir="ltr" className="group relative grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar name={match.player.username} avatarUrl={match.player.avatarUrl} className="h-9 w-9 shrink-0 border-2 border-brand/60 text-[10px] shadow-[0_0_18px_rgba(32,184,121,.2)]" />
          <p dir="auto" title={match.player.username} className="min-w-0 truncate text-xs font-bold text-white">{match.player.username}</p>
        </div>
        <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/35 bg-[#092216] text-brand shadow-[0_0_18px_rgba(32,184,121,.16)]">
          <span className="absolute inset-1 rounded-lg border border-brand/15" />
          <Swords size={18} strokeWidth={2.1} />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <p dir="auto" title={match.opponent.username} className="min-w-0 truncate text-right text-xs font-bold text-white/85">{match.opponent.username}</p>
          <UserAvatar name={match.opponent.username} avatarUrl={match.opponent.avatarUrl} className="h-9 w-9 shrink-0 border-2 border-white/20 text-[10px]" />
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[.09] bg-black/15 px-2 py-1 text-[11px] font-bold tabular-nums text-white/75">
          <Clock3 size={11} className={started ? "text-brand" : "text-brand/80"} />
          <span>{started ? "LIVE" : timer}</span>
        </div>
      </Link>
    </section>
  );
}
