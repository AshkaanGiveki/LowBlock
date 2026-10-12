"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Crown, Swords } from "lucide-react";
import { useLanguage, T } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";
import H2HHero from "@/components/H2HHero";
import H2HTodayMatches from "@/components/H2HTodayMatches";
import H2HRoundMatches from "@/components/H2HRoundMatches";

function H2HStandings({ standings, viewerId }: { standings: any[]; viewerId: string }) {
  return (
    <section className="mt-8 max-w-2xl overflow-hidden rounded-2xl border border-white/[.08] bg-[#101512]">
      <div className="flex items-center gap-2 border-b border-white/[.07] px-3 py-3 text-brand sm:px-4">
        <Crown size={14} />
        <h2 className="text-sm font-black"><T fa="جدول رتبه‌بندی" en="Standings" /></h2>
      </div>
      <div className="grid grid-cols-[22px_minmax(0,1fr)_24px_24px_24px_42px_48px] items-center gap-1 border-b border-white/[.06] px-3 py-2 text-[8px] font-black uppercase tracking-[.12em] text-white/30 sm:grid-cols-[26px_minmax(0,1fr)_30px_30px_30px_52px_56px] sm:gap-2 sm:px-4">
        <span>#</span>
        <span><T fa="بازیکن" en="Player" /></span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center"><T fa="امتیاز رو در رو" en="H2H" /></span>
        <span className="text-center"><T fa="امتیاز پیش‌بینی" en="PRED" /></span>
      </div>
      <div className="divide-y divide-white/[.05]">
        {standings.map((row: any) => (
          <div key={row.userId} className={`grid grid-cols-[22px_minmax(0,1fr)_24px_24px_24px_42px_48px] items-center gap-1 px-3 py-2 sm:grid-cols-[26px_minmax(0,1fr)_30px_30px_30px_52px_56px] sm:gap-2 sm:px-4 ${row.userId === viewerId ? "bg-brand/[.07]" : ""}`}>
            <span className="text-xs font-black text-brand">{row.rank}</span>
            <div className="flex min-w-0 items-center gap-2">
              <UserAvatar name={row.username} avatarUrl={row.avatarUrl} className="h-7 w-7 shrink-0 text-[8px]" />
              <span className="min-w-0 truncate text-[10px] font-bold text-white/80 sm:text-[11px]">{row.username}</span>
            </div>
            <span className="text-center text-[10px] font-bold text-white/70">{row.wins}</span>
            <span className="text-center text-[10px] font-bold text-white/50">{row.draws}</span>
            <span className="text-center text-[10px] font-bold text-white/50">{row.losses}</span>
            <span className="justify-self-center rounded-lg bg-brand/15 px-2 py-1 text-[11px] font-black text-brand">{row.h2hPoints}</span>
            <span className="justify-self-center rounded-lg bg-white/[.06] px-2 py-1 text-[11px] font-black text-white/75">{row.predictionPoints ?? 0}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

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
    <H2HTodayMatches slates={league.slates} leagueId={league.id} />
    <section className="mt-6 flex items-center justify-between rounded-[1.35rem] border border-white/[.08] bg-[#101713] px-4 py-3.5 md:px-5"><button type="button" onClick={() => go(-1)} disabled={day <= 1} aria-label="Previous round" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25"><ChevronLeft size={20} /></button><div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.2em] text-brand"><T fa="راند هفتگی" en="WEEKLY ROUND" /></p><h2 className="mt-0.5 text-xl font-black"><T fa="راند" en="Round" /> {day}</h2><p className="mt-0.5 text-[10px] text-white/35">{slate?.sourceDate ?? league.weekKey}</p></div><button type="button" onClick={() => go(1)} disabled={day >= league.slates.length} aria-label="Next round" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25"><ChevronRight size={20} /></button></section>
    <H2HRoundMatches round={round} />
    <H2HStandings standings={league.standings} viewerId={league.viewerId} />
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
  </div></main>;
}
