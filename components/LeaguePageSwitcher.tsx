"use client";

import Link from "next/link";
import { LEAGUES } from "@/lib/football/leagues";
import { LeagueLogo } from "@/components/LeagueLogo";
import { useLanguage } from "@/components/LanguageProvider";

export function LeaguePageSwitcher({ currentCode }: { currentCode: string }) {
  const { t } = useLanguage();

  return (
    <section aria-label={t("انتخاب لیگ", "Choose a league")} className="league-page-switcher mb-6 overflow-hidden rounded-[1.5rem] border border-white/[.08] bg-[linear-gradient(145deg,rgba(18,30,23,.96),rgba(9,14,11,.96))] p-3 shadow-[0_16px_45px_rgba(0,0,0,.18)] sm:p-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[.2em] text-brand">{t("رقابت‌ها", "COMPETITIONS")}</p>
          <h2 className="mt-1 truncate text-sm font-black sm:text-base">{t("لیگ دیگری را انتخاب کنید", "Switch competition")}</h2>
        </div>
      </div>
      <div className="league-page-switcher-scroll mt-3 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LEAGUES.map((league) => {
          const active = league.code === currentCode;
          return <Link key={league.code} href={`/leagues/${league.code}`} aria-label={t(league.faName, league.enName)} title={t(league.faName, league.enName)} aria-current={active ? "page" : undefined} className={`group relative grid h-14 min-w-14 snap-start place-items-center rounded-xl border p-2.5 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7ff4d] sm:h-16 sm:min-w-16 ${active ? "border-brand bg-brand/15 shadow-[0_8px_24px_rgba(32,184,121,.18)]" : "border-white/[.08] bg-white/[.025] hover:border-brand/45 hover:bg-brand/[.08]"}`}>
            <LeagueLogo src={league.logo} className="h-full w-full transition duration-200 group-hover:scale-105" />
          </Link>;
        })}
      </div>
    </section>
  );
}
