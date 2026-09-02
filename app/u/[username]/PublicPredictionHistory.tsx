"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { teamName } from "@/lib/football/team-names";

type Team = { id: number; name: string; logoUrl?: string | null };
type Row = { matchId: string; kickoffAt: string; leagueCode: string; matchday: number; homeTeam: Team; awayTeam: Team; predictedHome: number | null; predictedAway: number | null; actualHome: number | null; actualAway: number | null; points: number; exact: boolean };

function TeamBadge({ team }: { team: Team }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/[.06] p-1.5">{team.logoUrl ? <img src={team.logoUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-[9px] font-black text-white/60">{team.name.slice(0, 2).toUpperCase()}</span>}</span>;
}

export function PublicPredictionHistory({ username }: { username: string }) {
  const { language, t } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  async function load(next?: string | null) { setLoading(true); const query = new URLSearchParams({ limit: "12" }); if (next) query.set("cursor", next); const data = await fetch(`/api/profiles/${encodeURIComponent(username)}/predictions?${query}`).then(response => response.json()); setRows(current => next ? [...current, ...(data.rows ?? [])] : (data.rows ?? [])); setCursor(data.nextCursor ?? null); setLoading(false); }
  useEffect(() => { load(); }, [username]);
  const name = (team: Team) => teamName(language, team.id, team.name);
  return <section className="mt-4 rounded-3xl border border-white/10 bg-[#101512] p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black tracking-[.16em] text-brand">{t("سابقه پیش‌بینی", "PREDICTION HISTORY")}</p><h2 className="mt-1 text-2xl font-black">{t("پیش‌بینی‌های قبلی", "Past predictions")}</h2></div><Sparkles className="text-brand" size={20}/></div><div className="mt-4 space-y-2">{rows.map(row => <div key={row.matchId} className="rounded-2xl border border-white/[.06] bg-black/20 p-3"><div className="flex items-center justify-between text-[10px] text-[var(--muted)]"><span className="inline-flex items-center gap-1"><CalendarDays size={12}/>{new Date(row.kickoffAt).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB")}</span><span>{row.leagueCode} · {t(`هفته ${row.matchday}`, `Round ${row.matchday}`)}</span></div><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className="flex min-w-0 items-center gap-2"><TeamBadge team={row.homeTeam}/><span className="truncate text-xs font-bold">{name(row.homeTeam)}</span></div><span className="rounded-lg border border-brand/20 bg-brand/10 px-2 py-1 text-xs font-black text-brand">{row.predictedHome} - {row.predictedAway}</span><div className="flex min-w-0 items-center justify-end gap-2"><span className="truncate text-end text-xs font-bold">{name(row.awayTeam)}</span><TeamBadge team={row.awayTeam}/></div></div><div className="mt-3 flex items-center justify-between text-[10px] text-[var(--muted)]"><span>{t("نتیجه", "Result")}: {row.actualHome} - {row.actualAway}</span><span className={row.exact ? "text-[#e8c66a]" : "text-brand"}>{row.exact ? t("دقیق", "Exact") : `+${row.points} ${t("امتیاز", "pts")}`}</span></div></div>)}{!rows.length && !loading && <p className="py-8 text-center text-sm text-[var(--muted)]">{t("هنوز پیش‌بینی قفل‌شده‌ای وجود ندارد.", "No locked predictions yet.")}</p>}</div>{cursor && <button disabled={loading} onClick={() => load(cursor)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm font-black text-brand"><ChevronDown size={16}/>{loading ? "…" : t("نمایش بیشتر", "Load more")}</button>}</section>;
}
