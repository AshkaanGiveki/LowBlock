"use client";
import { LEAGUES } from "@/lib/football/leagues";
const logos = LEAGUES.map((league) => ({ code: league.code, logo: league.logo }));
export function LogoLoop() { const items = [...logos, ...logos, ...logos]; return <section className="overflow-hidden border-y border-white/[.06] bg-[#090d0b] py-6" aria-label="Supported leagues"><div className="logo-loop-track flex w-max items-center gap-12 px-6">{items.map((league, i) => <img key={`${league.code}-${i}`} src={league.logo} alt="" className="league-logo h-12 w-12 shrink-0 object-contain opacity-80 transition hover:opacity-100" />)}</div></section>; }
