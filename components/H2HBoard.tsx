"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Crown, Swords } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage, T } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import H2HHero from "@/components/H2HHero";
import H2HRoundMatches from "@/components/H2HRoundMatches";

export default function H2HBoard() {
  const { t } = useLanguage();
  const [data, setData] = useState<any>();
  const [day, setDay] = useState(1);
  const [error, setError] = useState("");
  const initialized = useRef(false);

  const load = () => fetch("/api/h2h/current").then((response) => response.json()).then((next) => {
    setData(next);
    if (!initialized.current && next.league?.slates?.length) {
      const upcoming = next.league.slates.find((slate: any) => new Date(slate.firstKickoffAt) > new Date());
      setDay(upcoming?.matchday ?? next.league.slates[next.league.slates.length - 1].matchday);
      initialized.current = true;
    }
  }).catch(() => setError("Could not load H2H"));
  useEffect(() => { load(); }, []);

  if (!data) return <main className="min-h-screen bg-[#080b0a]" />;
  if (!data.enabled) return null;
  const league = data.league;
  if (!league) return <main className="min-h-screen bg-[#080b0a] px-5 pb-28 pt-28"><div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[#111714] p-10 text-center"><Swords className="mx-auto text-brand" size={38} /><h1 className="mt-5 text-3xl font-black">{t("رو در رو", "Head to Head")}</h1><p className="mt-3 text-sm text-white/50">{t("گروه این هفته هنوز آماده نشده است.", "This week's group is not ready yet.")}</p></div></main>;

  const round = league.h2hMatches?.find((item: any) => item.matchday === day);
  const slate = league.slates.find((item: any) => item.matchday === day);
  const go = (direction: number) => setDay((current) => Math.min(league.slates.length, Math.max(1, current + direction)));

  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl">
    <H2HHero weekKey={league.weekKey} slateCount={league.slates.length} activeSlate={day} />
    <section className="mt-6 flex items-center justify-between rounded-[1.35rem] border border-white/[.08] bg-[#101713] px-4 py-3.5 md:px-5"><button type="button" onClick={() => go(-1)} disabled={day <= 1} aria-label="Previous round" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25"><ChevronLeft size={20} /></button><div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.2em] text-brand"><T fa="راند هفتگی" en="WEEKLY ROUND" /></p><h2 className="mt-0.5 text-xl font-black"><T fa="راند" en="Round" /> {day}</h2><p className="mt-0.5 text-[10px] text-white/35">{slate?.sourceDate ?? league.weekKey}</p></div><button type="button" onClick={() => go(1)} disabled={day >= league.slates.length} aria-label="Next round" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25"><ChevronRight size={20} /></button></section>
    <H2HRoundMatches round={round} />
    <section className="mt-8 overflow-hidden rounded-3xl border border-white/[.08] bg-[#101512]"><div className="flex items-center gap-2 border-b border-white/[.07] px-5 py-4 text-brand"><Crown size={16} /><h2 className="font-black"><T fa="جدول رتبه‌بندی" en="Standings" /></h2><span className="ms-auto text-xs text-white/35">Pts · W · D · L</span></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-[10px] uppercase tracking-widest text-white/35"><tr><th className="px-5 py-3 text-left">#</th><th className="px-3 py-3 text-center"><T fa="بازیکن" en="Player" /></th><th className="px-3 py-3 text-right">Pts</th><th className="px-3 py-3 text-right">W</th><th className="px-3 py-3 text-right">D</th><th className="px-3 py-3 text-right">L</th><th className="px-5 py-3 text-right">Pred</th></tr></thead><tbody className="divide-y divide-white/[.06]">{league.standings.map((row: any) => <tr key={row.userId} className={row.userId === league.viewerId ? "bg-brand/[.06]" : ""}><td className="px-5 py-4 font-black text-brand">{row.rank}</td><td className="px-3 py-3"><div className="flex flex-col items-center gap-1"><UserAvatar name={row.username} avatarUrl={row.avatarUrl} className="h-9 w-9 text-[10px]" /><span className="max-w-[96px] truncate text-[10px] font-bold text-white/80">{row.username}</span>{row.userId === league.viewerId && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[8px] font-black text-brand"><T fa="شما" en="YOU" /></span>}</div></td><td className="px-3 py-4 text-right text-lg font-black">{row.h2hPoints}</td><td className="px-3 py-4 text-right text-white/60">{row.wins}</td><td className="px-3 py-4 text-right text-white/60">{row.draws}</td><td className="px-3 py-4 text-right text-white/60">{row.losses}</td><td className="px-5 py-4 text-right text-xs text-white/35">{row.predictionPoints ?? 0}</td></tr>)}</tbody></table></div></section>
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
  </div></main>;
}
