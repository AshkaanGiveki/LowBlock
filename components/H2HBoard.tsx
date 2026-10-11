"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Crown, Shield, Star, Trophy } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { LocalDate, LocalTime } from "@/components/LocalDateTime";

type Fixture = { matchId: string; kickoffAt: string; leagueCode: string; homeTeam: any; awayTeam: any; prediction: any; isGold: boolean };
type Payload = { enabled: boolean; league: any | null; reason?: string; weekKey?: string };

export default function H2HBoard() {
  const { t } = useLanguage();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const load = () => fetch("/api/h2h/current").then((r) => r.json()).then(setData).catch(() => setError("Could not load H2H"));
  useEffect(() => { load(); }, []);
  async function chooseGold(matchday: number, matchId: string) {
    if (!data?.league) return;
    setSaving(`${matchday}:${matchId}`);
    const response = await fetch("/api/h2h/gold", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ leagueId: data.league.id, matchday, matchId }) });
    if (response.ok) await load(); else setError((await response.json().catch(() => ({}))).error ?? "Gold match is locked");
    setSaving("");
  }
  if (!data) return <main className="min-h-screen p-8" />;
  if (!data.enabled) return null;
  if (!data.league) return <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-[#101512] p-8"><Trophy className="text-brand" /><h1 className="mt-4 text-3xl font-black">H2H</h1><p className="mt-3 text-sm text-[var(--muted)]">{data.reason === "NO_CLUB" ? t("Ø¨Ø±Ø§ÛŒ Ø´Ø±Ú©Øª Ø¯Ø± H2H Ø¨Ø§ÛŒØ¯ Ø¹Ø¶Ùˆ Ø¨Ø§Ø´Ú¯Ø§Ù‡ Ø¨Ø§Ø´ÛŒØ¯.", "Join a Club to participate in H2H.") : t("Ù„ÛŒÚ¯ Ø§ÛŒÙ† Ù‡ÙØªÙ‡ Ù‡Ù†ÙˆØ² Ø³Ø§Ø®ØªÙ‡ Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.", "This week's H2H league is not available yet.")}</p></div></main>;
  const league = data.league;
  return <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-6xl">
    <section className="rounded-[2rem] border border-brand/25 bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.28),transparent_38%),linear-gradient(145deg,#14251c,#0a0f0c)] p-6 shadow-[0_28px_90px_rgba(0,0,0,.24)] sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand"><Shield size={14} /> H2H MODE</div><h1 className="mt-4 text-4xl font-black">{t("رو در رو", "Head to Head")}</h1><p className="mt-2 text-sm text-white/60">{t("هفت روز، هفت بازی رو در رو، یک قهرمان.", "Seven days. Seven head-to-head matchdays. One champion.")}</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-end"><div className="text-xs text-white/50">{league.weekKey}</div><div className="mt-1 font-black text-brand">{league.players.length} players</div></div></div>
      <div className="mt-7 grid gap-2 sm:grid-cols-4">{league.players.map((player: any) => <div key={player.userId} className="rounded-xl border border-white/[.08] bg-black/15 px-3 py-2 text-sm"><span className="block truncate font-bold">{player.username}</span><span className="text-xs text-white/40">{league.standings.find((row: any) => row.userId === player.userId)?.h2hPoints ?? 0} H2H pts</span></div>)}</div>
    </section>
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/[.08] bg-[#101512]"><div className="border-b border-white/[.07] p-5"><div className="flex items-center gap-2 text-brand"><Crown size={17} /><h2 className="font-black">{t("جدول H2H", "H2H leaderboard")}</h2></div><p className="mt-1 text-xs text-[var(--muted)]">{t("امتیازهای رو در رو بر اساس نتیجه هر اسلیت محاسبه می‌شود.", "Standings are decided by each slate result.")}</p></div><div className="divide-y divide-white/[.06]">{league.standings.map((row: any) => <div key={row.userId} className={`flex items-center gap-3 px-5 py-4 ${row.rank === 1 ? "bg-brand/[.07]" : ""}`}><b className="w-7 text-brand">{row.rank}</b><div className="min-w-0 flex-1"><b className="block truncate">{row.username}</b><small className="text-xs text-white/45">{row.wins}W · {row.draws}D · {row.losses}L</small></div><div className="text-end"><b className="block text-xl text-brand">{row.h2hPoints}</b><small className="text-[10px] text-white/40">H2H pts</small></div></div>)}</div></section>
    <div className="mt-6 space-y-5">{league.slates.map((slate: any) => <section key={slate.matchday} className="rounded-[2rem] border border-white/[.08] bg-[#101512] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-brand"><CalendarDays size={16} /><h2 className="font-black">Matchday {slate.matchday}</h2></div><p className="mt-1 text-xs text-[var(--muted)]">{slate.fixtures.length} fixtures · gold selection closes before the first kickoff</p></div><span className="text-xs text-white/50"><LocalDate value={slate.firstKickoffAt} /> · <LocalTime value={slate.firstKickoffAt} /></span></div><div className="mt-4 grid gap-3">{slate.fixtures.map((fixture: Fixture) => <div key={fixture.matchId} className="grid gap-3 rounded-2xl border border-white/[.07] bg-black/10 p-4 sm:grid-cols-[1fr_auto_1fr_auto]"><div className="min-w-0 text-sm font-bold sm:text-end">{fixture.homeTeam?.name}</div><div className="text-center text-xs text-white/45">{fixture.prediction ? `${fixture.prediction.homeGoals} - ${fixture.prediction.awayGoals}` : "—"}<small className="block mt-1"><LocalTime value={fixture.kickoffAt} /></small></div><div className="min-w-0 text-sm font-bold">{fixture.awayTeam?.name}</div><button type="button" onClick={() => chooseGold(slate.matchday, fixture.matchId)} disabled={!!saving || new Date() >= new Date(slate.goldDeadline)} className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-black ${fixture.isGold ? "bg-[#eacb70] text-black" : "border border-[#eacb70]/30 text-[#eacb70]"}`}><Star size={13} fill={fixture.isGold ? "currentColor" : "none"} />{fixture.isGold ? "Gold" : "Gold match"}</button></div>)}</div></section>)}</div>
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
  </div></main>;
}
