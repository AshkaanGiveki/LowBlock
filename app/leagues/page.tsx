import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { T } from "@/components/LanguageProvider";
import { LEAGUES } from "@/lib/football/leagues";
import { LeagueBrowser } from "@/components/LeagueBrowser";

export const metadata: Metadata = {
  title: "Competitions | LowBlock",
  description: "Explore every league and tournament available on LowBlock.",
};

export default function LeaguesPage() {
  return (
    <main className="min-h-screen pb-24 pt-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/[.08] bg-[radial-gradient(circle_at_top_right,rgba(127,255,0,.14),transparent_35%),linear-gradient(145deg,#17251b,#0d130f)] p-6 md:p-10">
          <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="rounded-2xl border border-brand/20 bg-brand/10 p-3 text-brand">
              <Compass size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-black tracking-[.16em] text-brand"><T fa="Ù„ÛŒÚ¯â€ŒÙ‡Ø§ Ùˆ ØªÙˆØ±Ù†Ù…Ù†Øªâ€ŒÙ‡Ø§" en="LEAGUES & TOURNAMENTS" /></p>
              <h1 className="mt-2 text-3xl font-black md:text-5xl"><T fa="Ù‡Ù…Ù‡ Ø±Ù‚Ø§Ø¨Øªâ€ŒÙ‡Ø§" en="All competitions" /></h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60"><T fa="Ø±Ù‚Ø§Ø§Ø¨Øª Ù…ÙˆØ±Ø¯ Ù†Ø¸Ø± Ø±Ø§ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯ Ùˆ Ù…Ø³ØªÙ‚ÛŒÙ… Ø¨Ù‡ ØµÙØ­Ù‡ Ø¢Ù† Ø¨Ø±ÙˆÛŒØ¯." en="Choose a competition and jump straight to its fixtures, rounds and leaderboard." /></p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-black md:text-2xl"><T fa="Ù‡Ù…Ù‡ Ù„ÛŒÚ¯â€ŒÙ‡Ø§" en="Browse competitions" /></h2>
            <span className="text-xs font-bold text-white/40">{LEAGUES.length}</span>
          </div>
          <LeagueBrowser />
        </section>
      </div>
    </main>
  );
}
