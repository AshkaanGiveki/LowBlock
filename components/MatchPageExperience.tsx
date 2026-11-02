"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { PredictionCard } from "@/components/PredictionCard";
import { TeamCrest } from "@/components/TeamCrest";
import { teamName } from "@/lib/football/team-names";
import { formatNumber } from "@/lib/text";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Flame,
  Radio,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

type Props = {
  match: any;
  initial?: { homeGoals: number; awayGoals: number };
  leagueName: string;
  leagueFaName: string;
  relatedMatches: any[];
  isLive: boolean;
  isFinished: boolean;
};

export function MatchPageExperience({ match, initial, leagueName, leagueFaName, relatedMatches, isLive, isFinished }: Props) {
  const { language, t } = useLanguage();
  const fa = language === "fa";
  const displayLeagueName = fa ? leagueFaName : leagueName;
  const home = teamName(language, match.homeTeam.id, match.homeTeam.name, undefined, match.homeTeam.faName);
  const away = teamName(language, match.awayTeam.id, match.awayTeam.name, undefined, match.awayTeam.faName);
  const hasScore = match.homeGoals != null && match.awayGoals != null;
  const kickoffLabel = new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(match.kickoffAt));

  return (
    <main lang={language} dir={fa ? "rtl" : "ltr"} className="relative min-h-screen overflow-hidden px-4 pb-28 pt-24 md:px-8 md:pt-28">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-brand/[.08] blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4 text-xs font-bold text-white/45">
          <a href="/matches" className="inline-flex items-center gap-2 transition hover:text-brand"><ArrowRight size={15} className={fa ? "rotate-180" : ""} /> {t("همه مسابقه‌ها", "All matches")}</a>
          <span className="hidden items-center gap-2 sm:flex"><CircleDot size={13} className="text-brand" /> {t("مرکز مسابقه", "Match centre")}</span>
        </div>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/[.1] bg-[#0e1713]/90 shadow-[0_28px_100px_rgba(0,0,0,.38)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(32,184,121,.2),transparent_48%),linear-gradient(135deg,rgba(255,255,255,.04),transparent_42%)]" />
          <div className="relative px-5 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand"><Trophy size={18} /></span><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-brand">{displayLeagueName}</p><p className="mt-1 text-xs font-semibold text-white/45">{t("مرکز رسمی مسابقه در LowBlock", "Official LowBlock match centre")}</p></div></div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] ${isLive ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : isFinished ? "border-white/15 bg-white/[.06] text-white/60" : "border-brand/30 bg-brand/10 text-brand"}`}>
                {isLive ? <><Radio size={13} className="animate-pulse" /> {t("زنده", "Live now")}</> : isFinished ? t("پایان مسابقه", "Full time") : <><CalendarDays size={13} /> {kickoffLabel}</>}
              </div>
            </div>
            <div className="mt-10 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr] md:gap-10">
              <TeamHero name={home} logo={match.homeTeam.logoUrl} label={t("میزبان", "Home")} align="left" />
              <div className="order-first text-center md:order-none"><p className="text-[10px] font-black uppercase tracking-[.3em] text-white/35">{isLive ? t("در جریان", "In play") : isFinished ? t("نتیجه نهایی", "Final score") : t("شروع مسابقه", "Kick-off")}</p><div className="mt-2 flex items-center justify-center gap-3 text-5xl font-black tracking-[-.08em] text-white sm:text-7xl"><span>{hasScore ? formatNumber(match.homeGoals, language) : "—"}</span><span className="text-2xl text-brand/70 sm:text-3xl">:</span><span>{hasScore ? formatNumber(match.awayGoals, language) : "—"}</span></div>{!isLive && !isFinished && <p className="mt-2 text-xs font-bold text-brand">{t("قبل از سوت بازی نظر بده", "Make your call before the whistle")}</p>}</div>
              <TeamHero name={away} logo={match.awayTeam.logoUrl} label={t("مهمان", "Away")} align="right" />
            </div>
            <div className="mx-auto mt-9 flex max-w-xl flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-white/50"><span className="inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-black/20 px-3 py-2"><Users size={13} className="text-brand" /> {t("با جامعه پیش‌بینی کن", "Predict with the community")}</span><span className="inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-black/20 px-3 py-2"><Sparkles size={13} className="text-brand" /> {t("رکورد امتیازت را بساز", "Build your score streak")}</span></div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)] lg:items-start">
          <section><div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-brand">{t("نوبت تو", "Your moment")}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{t("چه تیمی امتیاز می‌گیرد؟", "Who takes the points?")}</h1></div><span className="hidden items-center gap-1.5 text-xs font-bold text-white/35 sm:flex"><Flame size={14} className="text-brand" /> {t("یک پیش‌بینی، یک نتیجه", "One pick. One result.")}</span></div><PredictionCard match={match} initial={initial} openOnMount={false} index={0} /></section>
          <aside className="space-y-4"><div className="rounded-[1.5rem] border border-brand/20 bg-brand/[.07] p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-[#07100b]"><BarChart3 size={17} /></span><div><h2 className="text-sm font-black text-white">{t("برتری‌ات را حفظ کن", "Keep your edge")}</h2><p className="mt-1 text-xs leading-5 text-white/50">{t("پیش‌بینی تو بخشی از داستان مسابقه و مسیر صعودت در جدول می‌شود.", "Your prediction becomes part of the live match story and your leaderboard climb.")}</p></div></div><a href="/leaderboard" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-brand transition hover:text-white">{t("جدول امتیازات", "See the leaderboard")} <ChevronRight size={14} className={fa ? "rotate-180" : ""} /></a></div><a href="/h2h" className="group flex items-center justify-between rounded-[1.5rem] border border-white/[.08] bg-white/[.035] p-5 transition hover:border-brand/30 hover:bg-white/[.06]"><span><span className="block text-[10px] font-black uppercase tracking-[.18em] text-white/35">{t("بیشتر کشف کن", "Go deeper")}</span><span className="mt-1 block text-sm font-black text-white">{t("ذهن‌های فوتبالی را مقایسه کن", "Compare football minds")}</span></span><span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/45 transition group-hover:border-brand group-hover:text-brand"><ChevronRight size={16} className={fa ? "rotate-180" : ""} /></span></a></aside>
        </div>

        {relatedMatches.length > 0 && <section className="mt-14"><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-brand">{t("اینجا متوقف نشو", "Don’t stop here")}</p><h2 className="mt-1 text-2xl font-black tracking-tight">{t(`بیشتر از ${leagueFaName}`, `More from ${leagueName}`)}</h2></div><a href="/matches" className="inline-flex items-center gap-1 text-xs font-black text-brand">{t("مشاهده همه", "View all")} <ChevronRight size={14} className={fa ? "rotate-180" : ""} /></a></div><div className="grid gap-3 md:grid-cols-3">{relatedMatches.map((item) => <RelatedMatch key={item.providerMatchId} match={item} language={language} />)}</div></section>}
      </div>
    </main>
  );
}

function TeamHero({ name, logo, label, align }: { name: string; logo?: string | null; label: string; align: "left" | "right" }) {
  return <div className={`flex items-center gap-4 ${align === "right" ? "justify-end text-right" : "text-left"}`}><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/35">{label}</p><h2 className="mt-1 truncate text-xl font-black text-white sm:text-2xl">{name}</h2></div><div className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.35rem] border border-white/10 bg-black/25 p-3 shadow-[0_10px_30px_rgba(0,0,0,.25)] sm:h-20 sm:w-20"><TeamCrest name={name} logo={logo} className="h-full w-full object-contain" /></div></div>;
}

function RelatedMatch({ match, language }: { match: any; language: "fa" | "en" }) {
  const fa = language === "fa";
  const home = teamName(language, match.homeTeam.id, match.homeTeam.name, undefined, match.homeTeam.faName);
  const away = teamName(language, match.awayTeam.id, match.awayTeam.name, undefined, match.awayTeam.faName);
  return <a href={`/matches/${encodeURIComponent(match.providerMatchId)}`} className="group rounded-[1.25rem] border border-white/[.08] bg-white/[.03] p-4 transition hover:-translate-y-0.5 hover:border-brand/35 hover:bg-white/[.06]"><div className="flex items-center justify-between text-[10px] font-bold text-white/35"><span>{new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", { day: "numeric", month: "short" }).format(new Date(match.kickoffAt))}</span><ChevronRight size={14} className={`${fa ? "rotate-180" : ""} transition group-hover:text-brand`} /></div><div className="mt-4 flex items-center justify-between gap-3 text-xs font-black"><span className="flex min-w-0 items-center gap-2 truncate"><TeamCrest name={home} logo={match.homeTeam.logoUrl} className="h-6 w-6 shrink-0 object-contain" />{home}</span><span className="text-white/30">{fa ? "مقابل" : "vs"}</span><span className="flex min-w-0 items-center justify-end gap-2 truncate text-right">{away}<TeamCrest name={away} logo={match.awayTeam.logoUrl} className="h-6 w-6 shrink-0 object-contain" /></span></div></a>;
}
