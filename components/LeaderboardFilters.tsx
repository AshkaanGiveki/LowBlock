"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Globe2 } from "lucide-react";
import { LEAGUES } from "@/lib/football/leagues";
import { useLanguage, T } from "@/components/LanguageProvider";

type Selection = { lifetime: boolean; leagueCode?: string };

export function LeaderboardFilters({ lifetime, leagueCode, onNavigate }: { lifetime: boolean; leagueCode?: string; onNavigate?: (selection: Selection) => void }) {
  const { t } = useLanguage();
  const [optimistic, setOptimistic] = useState<Selection>({ lifetime, leagueCode });
  useEffect(() => setOptimistic({ lifetime, leagueCode }), [lifetime, leagueCode]);
  const selectedLifetime = optimistic.lifetime;
  const selectedLeague = optimistic.leagueCode;
  const href = (scope: string, league?: string) => `/lowblock?scope=${scope}${league ? `&league=${league}` : ""}`;
  const choose = (selection: Selection) => (event: React.MouseEvent<HTMLAnchorElement>) => { if (selection.lifetime === lifetime && selection.leagueCode === leagueCode) return; setOptimistic(selection); onNavigate?.(selection); };
  return <section className="mt-6 space-y-3 rounded-[1.75rem] border border-white/[.08] bg-[#101512] p-3 shadow-[0_16px_50px_rgba(0,0,0,.16)] md:p-4"><div className="flex items-center justify-between px-1"><p className="text-[10px] font-black tracking-[.18em] text-[var(--muted)]">{t("بازه امتیازها", "TIME RANGE")}</p><span className="text-xs text-brand">{selectedLifetime ? t("تمام دوران", "Lifetime") : t("فصل جاری", "Current season")}</span></div><div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[.07] bg-black/20 p-1"><Link onClick={choose({ lifetime: false, leagueCode })} href={href("season", selectedLeague)} className={`relative rounded-xl px-4 py-3 text-center text-sm font-black ${!selectedLifetime ? "text-white" : "text-[var(--muted)]"}`}>{!selectedLifetime && <motion.span layoutId="leaderboard-scope" className="absolute inset-0 rounded-xl bg-brand" transition={{ type: "spring", stiffness: 500, damping: 35 }}/>}<span className="relative z-10"><T fa="فصل" en="Season"/></span></Link><Link onClick={choose({ lifetime: true, leagueCode })} href={href("lifetime", selectedLeague)} className={`relative rounded-xl px-4 py-3 text-center text-sm font-black ${selectedLifetime ? "text-white" : "text-[var(--muted)]"}`}>{selectedLifetime && <motion.span layoutId="leaderboard-scope" className="absolute inset-0 rounded-xl bg-brand" transition={{ type: "spring", stiffness: 500, damping: 35 }}/>}<span className="relative z-10"><T fa="تمام دوران" en="Lifetime"/></span></Link></div><div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"><Link onClick={choose({ lifetime: selectedLifetime })} href={href(selectedLifetime ? "lifetime" : "season")} aria-label={t("همه لیگ‌ها", "All leagues")} className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${!selectedLeague ? "border-brand bg-brand/15" : "border-white/10 bg-white/[.03]"}`}><Globe2 size={19} className={!selectedLeague ? "text-brand" : "text-[var(--muted)]"}/></Link>{LEAGUES.map(league => <Link onClick={choose({ lifetime: selectedLifetime, leagueCode: league.code })} key={league.code} href={href(selectedLifetime ? "lifetime" : "season", league.code)} aria-label={league.enName} aria-pressed={selectedLeague === league.code} className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border p-2 ${selectedLeague === league.code ? "border-brand bg-brand/15" : "border-white/10 bg-white/[.03]"}`}>{selectedLeague === league.code && <motion.span layoutId="leaderboard-league" className="absolute inset-0 rounded-xl ring-2 ring-brand/70" transition={{ type: "spring", stiffness: 500, damping: 35 }}/>}<img src={league.logo} alt="" className="league-logo relative z-10 h-full w-full object-contain"/></Link>)}</div></section>;
}
