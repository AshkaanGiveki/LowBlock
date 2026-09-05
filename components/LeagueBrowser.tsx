"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { LEAGUES } from "@/lib/football/leagues";
import { LocaleChevron } from "@/components/LocaleChevron";
import { T } from "@/components/LanguageProvider";

export function LeagueBrowser() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => { void fetch("/api/tournament-preferences", { cache: "no-store" }).then((response) => response.json()).then((data) => { setFavorites(Array.isArray(data.favoriteTournamentIds) ? data.favoriteTournamentIds : []); setAuthenticated(data.authenticated === true); }).catch(() => undefined); }, []);
  const toggle = async (code: string, favorite: boolean) => { if (!authenticated) return; setFavorites((current) => favorite ? [...new Set([...current, code])] : current.filter((value) => value !== code)); const response = await fetch("/api/tournament-preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ leagueCode: code, favorite }) }); if (!response.ok) return; const data = await response.json(); if (Array.isArray(data.favoriteTournamentIds)) setFavorites(data.favoriteTournamentIds); };
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{LEAGUES.map((league) => { const favorite = favorites.includes(league.code); return <div key={league.code} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#101512] p-4 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-[#142019]"><Link href={`/leagues/${league.code}`} className="flex min-w-0 flex-1 items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] p-2"><img src={league.logo} alt="" className="h-full w-full object-contain" /></div><div className="min-w-0 flex-1"><span className="block truncate text-sm font-bold"><T fa={league.faName} en={league.enName} /></span><span className="mt-1 block text-[10px] font-black tracking-[.15em] text-white/35">{league.code}</span></div></Link><button type="button" aria-label={favorite ? `Remove ${league.enName} from favourites` : `Add ${league.enName} to favourites`} aria-pressed={favorite} onClick={() => void toggle(league.code, !favorite)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${favorite ? "border-[#e8c66a]/60 bg-[#e8c66a]/15 text-[#e8c66a]" : "border-white/10 bg-white/[.03] text-white/35 hover:border-brand/40 hover:text-brand"}`}><Star size={17} fill={favorite ? "currentColor" : "none"} /></button><LocaleChevron className="shrink-0 text-white/35 transition group-hover:text-brand" /></div>; })}</div>;
}
