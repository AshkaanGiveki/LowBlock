"use client";

import { BadgeMinus, Trophy } from "lucide-react";
import { getLeague } from "@/lib/football/leagues";

export function DrawerCompetitionMeta({ competition, included, language }: { competition?: ReturnType<typeof getLeague>; included: boolean; language: "fa" | "en" }) {
  if (!competition) return null;
  const name = language === "fa" ? competition.faName : competition.enName;
  const label = language === "fa" ? (included ? "در جدول جهانی" : "خارج از جدول جهانی") : (included ? "Global leaderboard" : "Outside global leaderboard");
  return <div className="my-5 flex items-stretch justify-center gap-[15px]" aria-label={name}>
    <div className="flex min-h-10 items-center gap-2 rounded-2xl border border-brand/25 bg-[#10231a] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,.18)]">
      <img src={competition.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
      <span className="max-w-[10rem] truncate text-[10px] font-black text-white/80">{name}</span>
    </div>
    <div className={`flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,.18)] ${included ? "border-brand/25 bg-brand/10 text-brand" : "border-white/15 bg-white/[.06] text-white/65"}`}>
      {included ? <Trophy size={15} className="shrink-0" /> : <BadgeMinus size={15} className="shrink-0" />}
      <span className="whitespace-nowrap text-[10px] font-black">{label}</span>
    </div>
  </div>;
}
