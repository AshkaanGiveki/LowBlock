"use client";
import { LEAGUES } from "@/lib/football/leagues";
const logos = LEAGUES.map((league) => ({ code: league.code, logo: `https://media.api-sports.io/football/leagues/${league.apiLeagueId}.png` }));
export function LogoLoop() { const items = [...logos, ...logos, ...logos]; return <section className="overflow-hidden border-y border-white/[.06] bg-[#090d0b] py-6" aria-label="Supported leagues"><div className="logo-loop-track flex w-max items-center gap-12 px-6">{items.map((league, i) => <img key={`${league.code}-${i}`} src={league.logo} alt="" className="h-12 w-12 shrink-0 object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" />)}</div></section>; }
