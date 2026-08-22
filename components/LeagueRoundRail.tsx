"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Radio } from "lucide-react";
import { T, useLanguage } from "@/components/LanguageProvider";

type Round = { number: number; count: number; active: boolean; completed: boolean; live?: boolean };

export function LeagueRoundRail({ code, rounds, basePath }: { code: string; rounds: Round[]; basePath?: string }) {
  const { language } = useLanguage();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const base = basePath ?? `/leagues/${code}`;
  useEffect(() => { activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: language === "fa" ? "center" : "center" }); }, [language, rounds]);
  return <section className="mt-8 overflow-hidden rounded-3xl border border-white/[.08] bg-[linear-gradient(145deg,#121c16,#0d120f)] p-4 md:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-black tracking-[.2em] text-brand"><T fa="تقویم راندها" en="ROUND CALENDAR" /></p><h2 className="mt-1 text-xl font-black"><T fa="یک راند را انتخاب کنید" en="Choose a round" /></h2></div><span className="text-xs text-[var(--muted)]">{rounds.length} <T fa="راند" en="rounds" /></span></div><div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">{rounds.map((round) => <Link ref={round.active ? activeRef : undefined} key={round.number} href={`${base}/round/${round.number}`} aria-label={`${language === "fa" ? "راند" : "Round"} ${round.number}${round.live ? ` · ${language === "fa" ? "زنده" : "LIVE"}` : ""}`} className={`relative min-w-[100px] snap-center rounded-2xl border p-3 text-center transition ${round.live ? "border-red-400/60 bg-red-400/10 shadow-[0_8px_28px_rgba(248,113,113,.16)]" : round.active ? "border-brand bg-brand/15 shadow-[0_8px_28px_rgba(32,184,121,.18)]" : "border-white/10 bg-black/15 hover:border-brand/50"}`}><span className={`inline-flex items-center gap-1 text-[10px] font-black ${round.live ? "text-red-300" : "text-[var(--muted)]"}`}>{round.live ? <><Radio size={11} className="animate-pulse" /><T fa="زنده" en="LIVE" /></> : round.active ? <T fa="فعال" en="ACTIVE" /> : <T fa="راند" en="ROUND" />}</span><b className="mt-1 block text-2xl">{round.number}</b><small className="mt-1 block text-[10px] text-[var(--muted)]">{round.count} <T fa="بازی" en="matches" /></small>{round.live && <i className="absolute end-2 top-2 h-2 w-2 animate-pulse rounded-full bg-red-300 shadow-[0_0_10px_#fca5a5]" />}{round.active && !round.live && <i className="absolute end-2 top-2 h-2 w-2 rounded-full bg-brand shadow-[0_0_10px_#20b879]" />}</Link>)}</div></section>;
}
