"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, ChevronRight, Radio } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { MatchAnalytics } from "@/components/MatchAnalytics";
import { formatIranDate, formatIranTime } from "@/lib/football/time";
import { teamName } from "@/lib/football/team-names";
import { closeMatchRoute, openMatchRoute } from "@/components/matchNavigation";

type Fixture = { providerMatchId: string; kickoffAt: string; status: string; homeGoals: number | null; awayGoals: number | null; homeTeam: { id: number; name: string; logoUrl: string | null }; awayTeam: { id: number; name: string; logoUrl: string | null } };

export function RoundMatchGrid({ fixtures, focusMatchId }: { fixtures: Fixture[]; focusMatchId?: string }) {
  const { language, t } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const locale = language === "fa" ? "fa-IR" : "en-GB";
  useEffect(() => { if (!focusMatchId || !fixtures.some((fixture) => fixture.providerMatchId === focusMatchId)) return; const timer = window.setTimeout(() => { document.querySelector(`[data-match-id="${CSS.escape(focusMatchId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); openMatchRoute(focusMatchId, window.location.pathname); setSelected(focusMatchId); }, 80); return () => window.clearTimeout(timer); }, [fixtures, focusMatchId]);
  return <>
    <section className="mt-7">
      <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-black tracking-[.18em] text-brand">{t("مسابقه‌های دور", "ROUND FIXTURES")}</p><h2 className="mt-1 text-2xl font-black">{t("همه بازی‌های این دور", "Every match in this round")}</h2></div><span className="text-xs text-[var(--muted)]">{fixtures.length} {t("بازی", "matches")}</span></div>
      <div className="grid gap-3 sm:grid-cols-2">{fixtures.map((fixture) => {
        const live = fixture.status === "LIVE";
        const finished = fixture.status === "FINISHED";
        return <button key={fixture.providerMatchId} data-match-id={fixture.providerMatchId} onClick={() => { openMatchRoute(fixture.providerMatchId, window.location.pathname); setSelected(fixture.providerMatchId); }} className="group relative overflow-hidden rounded-[1.35rem] border border-white/[.08] bg-[linear-gradient(145deg,#14221a,#0d120f)] p-4 text-start transition hover:-translate-y-1 hover:border-brand/50 hover:shadow-[0_18px_45px_rgba(32,184,121,.14)]">
          <div className="flex items-center justify-between text-[10px] text-[var(--muted)]"><span className="inline-flex items-center gap-1.5"><CalendarDays size={13}/>{formatIranDate(fixture.kickoffAt, locale)} · {formatIranTime(fixture.kickoffAt, locale)}</span><span className={`inline-flex items-center gap-1 font-black ${live ? "text-red-300" : finished ? "text-brand" : ""}`}>{live && <Radio size={11} className="animate-pulse"/>}{fixture.status}</span></div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center"><Team team={fixture.homeTeam} language={language}/><div><strong className="block text-2xl font-black tracking-tight">{fixture.homeGoals === null ? "—" : `${fixture.homeGoals} - ${fixture.awayGoals}`}</strong><span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-brand"><BarChart3 size={12}/>{t("تحلیل", "Analysis")}</span></div><Team team={fixture.awayTeam} language={language}/></div>
          <div className="mt-4 flex items-center justify-end gap-1 text-[10px] font-black text-white/45 transition group-hover:text-brand">{t("مشاهده جزئیات", "View details")}<ChevronRight size={14}/></div>
        </button>;
      })}</div>
    </section>
    {selected && <MatchAnalytics matchId={selected} onClose={() => { setSelected(null); closeMatchRoute(); }} />}
  </>;
}

function Team({ team, language }: { team: Fixture["homeTeam"]; language: "fa" | "en" }) { return <div className="min-w-0"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[.06] p-2"><img src={team.logoUrl ?? "/icon.png"} alt="" className="h-full w-full object-contain" /></span><span className="mt-2 block truncate text-[11px] font-bold">{teamName(language, team.id, team.name)}</span></div>; }
