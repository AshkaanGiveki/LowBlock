"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Crown, Swords, UserPlus, UsersRound } from "lucide-react";
import { T } from "@/components/LanguageProvider";
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

function H2HAccessCard({ reason, clubMemberCount, observer = false }: { reason?: string; clubMemberCount?: number; observer?: boolean }) {
  if (observer) return (
    <section className="mt-5 flex max-w-5xl items-center gap-3 rounded-2xl border border-white/[.08] bg-[#101713] px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Swords size={17} /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-brand"><T fa="این هفته صعود نکردید" en="NOT QUALIFIED THIS WEEK" /></p>
        <p className="mt-0.5 text-xs text-white/55"><T fa="رویارویی‌ها و جدول را دنبال کنید؛ در جدول باشگاه بهتر رقابت کنید تا برای تورنمنت H2H هفته بعد انتخاب شوید." en="Follow the matchups and standings, then climb your Club leaderboard to qualify for next week’s H2H tournament." /></p>
      </div>
      <Link href="/club" className="ms-auto inline-flex shrink-0 items-center rounded-lg border border-brand/25 bg-brand/10 px-2.5 py-1.5 text-[10px] font-black text-brand transition hover:bg-brand/20"><T fa="رقابت بیشتر" en="Compete harder" /></Link>
    </section>
  );

  const noClub = reason === "NO_CLUB";
  const tooSmall = reason === "CLUB_TOO_SMALL";
  const icon = noClub ? <UserPlus size={20} /> : <UsersRound size={20} />;
  return (
    <section className="relative mt-6 max-w-2xl overflow-hidden rounded-[1.5rem] border border-brand/20 bg-[linear-gradient(135deg,rgba(32,184,121,.12),rgba(16,23,19,.96)_60%)] px-5 py-5">
      <div className="pointer-events-none absolute -end-10 -top-16 h-36 w-36 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand/25 bg-brand/10 text-brand">{icon}</span>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-brand">{noClub ? <T fa="باشگاهت را پیدا کن" en="FIND YOUR CLUB" /> : tooSmall ? <T fa="رقابت رو در رو" en="HEAD TO HEAD" /> : <T fa="رقابت این هفته" en="THIS WEEK’S H2H" />}</p>
          <h2 className="mt-1 text-lg font-black text-white">{noClub ? <T fa="برای ورود به H2H به یک باشگاه بپیوندید" en="Join a club to enter H2H" /> : tooSmall ? <T fa="باشگاهت برای H2H هنوز بازیکن کافی ندارد" en="Your club needs more H2H players" /> : <T fa="گروه H2H این هفته در حال آماده‌سازی است" en="This week’s H2H group is being prepared" />}</h2>
          <p className="mt-1.5 max-w-xl text-xs leading-6 text-white/55">{noClub ? <T fa="به یک باشگاه بپیوند تا با هم‌تیمی‌هایت برای بازی‌های طلایی و جدول رو در رو رقابت کنی." en="Join a club to compete with teammates for Gold Picks and a place in the H2H standings." /> : tooSmall ? <T fa={`برای فعال‌شدن H2H، حداقل ۸ عضو آماده رقابت لازم است. اکنون ${clubMemberCount ?? 0} عضو دارید؛ چند بازیکن دیگر دعوت کنید و رقابت را شروع کنید.`} en={`H2H needs at least 8 willing players. Your club has ${clubMemberCount ?? 0} member${clubMemberCount === 1 ? "" : "s"}; invite a few more and start the race.`} /> : <T fa="به‌محض آماده‌شدن گروه، رویارویی‌ها و جدول اینجا نمایش داده می‌شوند." en="The matchups and standings will appear here as soon as the group is ready." />}</p>
          <Link href="/club" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-[11px] font-black text-[#06120c] transition hover:bg-brand/90"><T fa={noClub ? "پیدا کردن باشگاه" : "رفتن به باشگاه"} en={noClub ? "Find a club" : "Open club"} /><ArrowRight size={14} /></Link>
        </div>
      </div>
    </section>
  );
}

export default function H2HBoard() {
  const [data, setData] = useState<any>();
  const [day, setDay] = useState(1);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const initialized = useRef(false);

  const load = () => fetch("/api/h2h/current", { cache: "no-store" }).then((response) => response.json()).then((next) => {
    setData(next);
    if (!initialized.current && next.league?.slates?.length) {
      const upcoming = next.league.slates.find((slate: any) => new Date(slate.firstKickoffAt) > new Date());
      setDay(upcoming?.matchday ?? next.league.slates[next.league.slates.length - 1].matchday);
      initialized.current = true;
    }
  }).catch(() => setError("Could not load H2H"));
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  if (!data) return <main className="min-h-screen bg-[#080b0a]" />;
  if (!data.enabled) return null;
  const league = data.league;
  if (!league) return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl"><H2HHero slateCount={7} activeSlate={1} progressSlate={1} /><H2HAccessCard reason={data.reason} clubMemberCount={data.clubMemberCount} /></div></main>;

  // The weekly H2H track is always seven rounds, even while future dates are
  // still being discovered and their slates have not been materialized yet.
  const availableMatchdays = Array.from({ length: 7 }, (_, index) => index + 1);
  const selectedIndex = Math.max(0, availableMatchdays.indexOf(day));
  const activeMatchday = availableMatchdays[selectedIndex] ?? 1;
  const round = league.h2hMatches?.find((item: any) => item.matchday === activeMatchday);
  const slate = league.slates.find((item: any) => item.matchday === activeMatchday);
  const progressSlate = Math.max(1, availableMatchdays.filter((matchday: number) => {
    const item = league.slates.find((candidate: any) => Number(candidate.matchday) === matchday);
    return item && new Date(item.firstKickoffAt).getTime() <= now;
  }).length);
  const go = (direction: number) => setDay(availableMatchdays[Math.min(availableMatchdays.length - 1, Math.max(0, selectedIndex + direction))] ?? 1);

  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl">
    <H2HHero slateCount={7} activeSlate={selectedIndex + 1} progressSlate={progressSlate} />
    {data.viewerIncluded ? <H2HTodayMatches slates={league.slates} leagueId={league.id} /> : <H2HAccessCard observer />}
    <section dir="ltr" className="mt-6 flex items-center justify-between rounded-[1.35rem] border border-white/[.08] bg-[#101713] px-4 py-3.5 md:px-5"><button type="button" onClick={() => go(-1)} disabled={selectedIndex <= 0} aria-label="Previous round" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25"><ChevronLeft size={20} /></button><div dir="auto" className="text-center"><p className="text-[10px] font-black uppercase tracking-[.2em] text-brand"><T fa="راند هفتگی" en="WEEKLY ROUND" /></p><h2 className="mt-0.5 text-xl font-black"><T fa="راند" en="Round" /> {activeMatchday}</h2><p className="mt-0.5 text-[10px] text-white/35">{slate?.sourceDate ?? league.weekKey}</p></div><button type="button" onClick={() => go(1)} disabled={selectedIndex >= availableMatchdays.length - 1} aria-label="Next round" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/65 transition hover:border-brand/45 hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-25"><ChevronRight size={20} /></button></section>
    <H2HRoundMatches round={round} />
    <H2HStandings standings={league.standings} viewerId={league.viewerId} />
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
  </div></main>;
}
