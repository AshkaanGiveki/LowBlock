"use client";

import { motion } from "motion/react";
import { LEAGUES } from "@/lib/football/leagues";
import { T } from "@/components/LanguageProvider";

const logos = LEAGUES.map((league) => ({
  ...league,
  logo: `https://media.api-sports.io/football/leagues/${league.apiLeagueId}.png`,
}));

export function LogoLoop() {
  const items = [...logos, ...logos];
  return (
    <section className="relative overflow-hidden border-y border-white/[.06] bg-[#080b0a] py-7" aria-label="Five supported leagues">
      <div className="mx-auto mb-5 flex max-w-7xl items-center justify-between px-5 md:px-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.28em] text-brand">LOWBLOCK / LEAGUES</p>
          <p className="mt-1 text-sm font-bold text-white/70"><T fa="پنج لیگ بزرگ اروپا" en="Europe's top five leagues" /></p>
        </div>
        <span className="hidden text-xs text-white/35 sm:block"><T fa="داده رسمی و زنده" en="Official live data" /></span>
      </div>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <motion.div
          className="flex w-max items-center gap-4 px-4"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 28, ease: "linear", repeat: Infinity }}
          whileHover={{ animationPlayState: "paused" }}
        >
          {items.map((league, index) => (
            <div key={`${league.code}-${index}`} className="flex min-w-[180px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3 transition hover:border-brand/50 hover:bg-brand/[.08]">
              <img src={league.logo} alt="" className="h-10 w-10 object-contain" />
              <span className="text-sm font-black text-white"><T fa={league.faName} en={league.enName} /></span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
