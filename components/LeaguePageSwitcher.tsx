"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LEAGUES } from "@/lib/football/leagues";
import { LeagueLogo } from "@/components/LeagueLogo";
import { useLanguage } from "@/components/LanguageProvider";

export function LeaguePageSwitcher({ currentCode }: { currentCode: string }) {
  const { language, t } = useLanguage();

  return (
    <section aria-label={t("انتخاب لیگ", "Choose a league")} className="league-page-switcher mb-6 overflow-hidden rounded-[1.5rem] border border-white/[.08] bg-[linear-gradient(145deg,rgba(18,30,23,.96),rgba(9,14,11,.96))] p-3 shadow-[0_16px_45px_rgba(0,0,0,.18)] sm:p-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[.2em] text-brand">{t("رقابت‌ها", "COMPETITIONS")}</p>
          <h2 className="mt-1 truncate text-sm font-black sm:text-base">{t("لیگ دیگری را انتخاب کنید", "Switch competition")}</h2>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-white/35">{t("حرکت افقی", "Swipe to explore")}</span>
      </div>
      <div className="league-page-switcher-scroll mt-3 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LEAGUES.map((league) => {
          const active = league.code === currentCode;
          return <Link key={league.code} href={`/leagues/${league.code}`} aria-current={active ? "page" : undefined} className={`group relative flex min-w-[9.5rem] snap-start items-center gap-3 rounded-2xl border px-3 py-2.5 text-start transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7ff4d] sm:min-w-[11rem] ${active ? "border-brand bg-brand/15 text-white shadow-[0_8px_24px_rgba(32,184,121,.18)]" : "border-white/[.08] bg-white/[.025] text-white/70 hover:border-brand/45 hover:bg-brand/[.08] hover:text-white"}`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border p-1.5 transition ${active ? "border-brand/40 bg-black/20" : "border-white/[.08] bg-black/15 group-hover:border-brand/25"}`}><LeagueLogo src={league.logo} className="h-full w-full" /></span>
            <span className="min-w-0 flex-1"><b className="block truncate text-xs font-black">{t(league.faName, league.enName)}</b><small className="mt-1 block truncate text-[9px] font-bold uppercase tracking-[.12em] text-white/35">{language === "fa" ? league.short : league.code}</small></span>
            {active ? <span className="absolute inset-inline-end-2 inset-block-start-2 h-2 w-2 rounded-full bg-[#b7ff4d] shadow-[0_0_12px_rgba(183,255,77,.9)]" aria-hidden="true" /> : <ChevronLeft size={14} className="shrink-0 text-white/25 transition group-hover:text-brand" aria-hidden="true" />}
          </Link>;
        })}
      </div>
    </section>
  );
}
