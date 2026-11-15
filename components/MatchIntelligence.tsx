"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { PitchLineup } from "@/components/PitchLineup";
import { formatNumber } from "@/lib/text";
import { Activity, BarChart3, Clock3, History, ListOrdered, Radio, Shield, Users } from "lucide-react";

type Section = "overview" | "timeline" | "stats" | "lineups" | "form" | "h2h" | "standings";
type MatchIntel = {
  match: any;
  live: {
    score?: { home: number | null; away: number | null; elapsed?: number | null; status?: string };
    incidents?: Array<any>;
    stats?: Array<{ groupName: string; items: Array<any> }>;
    lineups?: any;
    updatedAt?: string | null;
  } | null;
  historical?: {
    local?: {
      form?: { home?: Array<any>; away?: Array<any> };
      h2h?: Array<any>;
      coverage?: string;
    };
    h2h?: Array<any>;
    standings?: Array<any>;
    standingsVerified?: boolean;
  } | null;
  availability: Record<string, boolean>;
};
const SECTIONS: Array<{ id: Section; en: string; fa: string }> = [
  { id: "overview", en: "Overview", fa: "خلاصه" },
  { id: "timeline", en: "Timeline", fa: "رویدادها" },
  { id: "stats", en: "Statistics", fa: "آمار" },
  { id: "lineups", en: "Lineups", fa: "ترکیب" },
  { id: "form", en: "Form", fa: "فرم تیم‌ها" },
  { id: "h2h", en: "H2H", fa: "تقابل‌ها" },
  { id: "standings", en: "Standings", fa: "جدول لیگ" },
];
function isFinished(status: string) {
  return ["FINISHED", "FT", "AET", "VOID", "POSTPONED", "CANCELLED"].includes(status.toUpperCase());
}
function pollingDelay(match: any, live: MatchIntel["live"]): number | null {
  const status = String(live?.score?.status || match?.status || "SCHEDULED").toUpperCase();
  if (isFinished(status)) return null;
  if (["LIVE", "IN_PLAY", "PAUSED", "SUSPENDED"].includes(status)) return 30_000;
  const start = new Date(match?.kickoffAt ?? 0).getTime();
  if (!Number.isFinite(start)) return 300_000;
  const until = start - Date.now();
  return until > 90 * 60_000 ? 600_000 : until > -3 * 60 * 60_000 ? 90_000 : 300_000;
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-white/[.025] px-5 py-9 text-center">
    <Shield size={23} className="mx-auto text-brand/70" />
    <p className="mt-3 text-sm font-bold text-white/80">{title}</p>
    <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-white/45">{description}</p>
  </div>;
}
function FormStrip({ fixtures, name, t }: { fixtures: Array<any>; name: string; t: (fa: string, en: string) => string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
    <h4 className="mb-3 text-sm font-black text-white">{name}</h4>
    {fixtures.length === 0 ? <p className="text-xs text-white/45">{t("سابقه کافی در داده‌های واردشده نیست.", "No previous results in the imported match history.")}</p> :
      <div className="space-y-2">{fixtures.map((row: any) => <div key={row.fixtureId} className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 flex-1 truncate text-white/65">{row.venue === "home" ? t("میزبان", "Home") : t("مهمان", "Away")} · {row.opponent}</span>
        <span className="tabular-nums text-white/80">{row.goalsFor} : {row.goalsAgainst}</span>
        <span className={"grid h-7 w-7 place-items-center rounded-lg font-black " + (row.result === "W" ? "bg-emerald-500/15 text-emerald-300" : row.result === "D" ? "bg-white/10 text-white/65" : "bg-rose-500/15 text-rose-300")}>{row.result}</span>
      </div>)}</div>}
  </div>;
}
export function MatchIntelligence({ matchId, initialMatch }: { matchId: string; initialMatch?: any }) {
  const { language, t } = useLanguage();
  const [selected, setSelected] = useState<Section>("overview");
  const [info, setInfo] = useState<MatchIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    let etag: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let latest: MatchIntel | null = null;
    const clear = () => { if (timer) clearTimeout(timer); timer = null; };
    const refresh = async () => {
      if (!active || document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/matches/" + encodeURIComponent(matchId) + "/intelligence", {
          cache: "no-store",
          headers: etag ? { "If-None-Match": etag } : {},
        });
        if (response.status !== 304) {
          if (!response.ok) throw new Error("Match intelligence unavailable");
          latest = await response.json() as MatchIntel;
          if (active) setInfo(latest);
          etag = response.headers.get("etag");
        }
        if (active) { setError(false); setLastChecked(Date.now()); }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
        if (active && document.visibilityState === "visible") {
          const delay = pollingDelay(latest?.match || initialMatch, latest?.live ?? null);
          if (delay !== null) timer = setTimeout(refresh, delay + Math.floor(Math.random() * 5000));
        }
      }
    };
    const onVisibility = () => {
      clear();
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; clear(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [matchId, initialMatch?.status, initialMatch?.kickoffAt]);

  const match = info?.match || initialMatch;
  const live = info?.live;
  const local = info?.historical?.local;
  const home = language === "fa" ? match?.homeTeam?.faName || match?.homeTeam?.name : match?.homeTeam?.name;
  const away = language === "fa" ? match?.awayTeam?.faName || match?.awayTeam?.name : match?.awayTeam?.name;
  const scoreHome = live?.score?.home ?? match?.homeGoals;
  const scoreAway = live?.score?.away ?? match?.awayGoals;
  const status = String(live?.score?.status || match?.status || "SCHEDULED");
  const stats = live?.stats ?? [];
  const incidents = live?.incidents ?? [];
  const meetings = local?.h2h?.length ? local.h2h : info?.historical?.h2h ?? [];
  const verifiedStandings = info?.historical?.standingsVerified === true ? info.historical.standings ?? [] : [];
  const currentAge = live?.updatedAt ? Date.now() - new Date(live.updatedAt).getTime() : null;
  const isStale = currentAge != null && Number.isFinite(currentAge) && currentAge > 120_000 && !isFinished(status);
  const digits = (n: number | null | undefined) => n == null ? "–" : formatNumber(n, language);

  return <section className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#0a1410] text-white" aria-label="Match Intelligence">
    <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,.1),transparent_75%)] px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.15em] text-brand">
          <Activity size={15} /> MATCH INTELLIGENCE
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/50">
          {isFinished(status) ? t("پایان مسابقه", "Final") : isStale ? t("اطلاعات قدیمی", "Stale data") : status === "LIVE" ? <><Radio size={12} /> LIVE</> : t("اطلاعات ثبت‌شده", "Cached data")}
        </span>
      </div>
      {match && <div className="mt-5 flex items-center justify-between gap-2 text-center">
        <div className="min-w-0 flex-1 truncate text-sm font-black sm:text-base">{home}</div>
        <div className="shrink-0 text-2xl font-black tabular-nums text-brand sm:text-3xl">{digits(scoreHome)} : {digits(scoreAway)}</div>
        <div className="min-w-0 flex-1 truncate text-sm font-black sm:text-base">{away}</div>
      </div>}
      <p className="mt-3 text-center text-[11px] text-white/40">
        {error ? t("ارتباط با داده‌های ذخیره‌شده قطع شده است؛ آخرین اطلاعات نمایش داده می‌شود.", "Cached data is temporarily unavailable; showing last known information.") :
          lastChecked ? t("اطلاعات از سرور LowBlock دریافت شده است.", "Data served from LowBlock cache, not directly from the provider.") :
          t("در حال بارگذاری...", "Loading match information...")}
      </p>
    </header>
    <nav className="flex gap-1 overflow-x-auto border-b border-white/10 p-2" aria-label="Match sections">
      {SECTIONS.map(({ id, en, fa }) => <button key={id} type="button"
        aria-pressed={selected === id} onClick={() => setSelected(id)}
        className={"shrink-0 rounded-xl px-3 py-2.5 text-xs font-bold transition " + (selected === id ? "bg-brand text-[#06110b]" : "text-white/55 hover:bg-white/5 hover:text-white")}>
        {t(fa, en)}
      </button>)}
    </nav>
    <div className="min-h-48 p-4 sm:p-6">
      {loading && !info ? <p className="py-12 text-center text-xs text-white/50">{t("در حال دریافت اطلاعات مسابقه...", "Loading match intelligence...")}</p> : !match ? <Empty title={t("اطلاعات در دسترس نیست", "Match unavailable")} description={t("شناسه مسابقه شناسایی نشد.", "This match could not be loaded.")} /> :
      selected === "overview" ? <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><Clock3 size={17} className="text-brand" /><p className="mt-2 text-[10px] text-white/45">{t("وضعیت مسابقه", "Match status")}</p><p className="mt-1 text-sm font-bold">{status}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><ListOrdered size={17} className="text-brand" /><p className="mt-2 text-[10px] text-white/45">{t("رویدادهای ثبت‌شده", "Recorded events")}</p><p className="mt-1 text-sm font-bold">{digits(incidents.length)}</p></div>
        </div>
        <h3 className="text-sm font-black">{t("فرم اخیر تیم‌ها", "Recent team form")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormStrip fixtures={local?.form?.home ?? []} name={home} t={t} />
          <FormStrip fixtures={local?.form?.away ?? []} name={away} t={t} />
        </div>
        <p className="text-[11px] leading-5 text-white/45">{t("نتایج تاریخی فقط از مسابقات واردشده به LowBlock محاسبه شده‌اند؛ ممکن است کامل نباشند.", "Historical results use only fixtures imported into LowBlock and may be incomplete.")}</p>
      </div> :
      selected === "stats" ? (stats.some(group => group?.items?.length) ? <div className="space-y-5">{stats.map((group, index) =>
        <div key={index}><h3 className="mb-3 flex items-center gap-2 text-xs font-black text-white/60"><BarChart3 size={15} className="text-brand" /> {group.groupName}</h3>
          <div className="space-y-3">{group.items.map((item, i) => <div key={i} className="grid grid-cols-[1fr_2fr_1fr] items-center gap-2 border-b border-white/5 pb-3 text-center text-xs">
            <span className="font-black">{String(item.home ?? "–")}</span>
            <span className="text-white/60">{item.name}</span>
            <span className="font-black">{String(item.away ?? "–")}</span>
          </div>)}</div>
        </div>)}</div> : <Empty title={t("آمار بازی هنوز موجود نیست", "Statistics not available yet")} description={t("فقط آمار تأییدشده از ارائه‌دهنده نمایش داده می‌شود.", "Only statistics actually received from the provider are displayed.")} />) :
      selected === "timeline" ? (incidents.length ? <div className="space-y-2">{[...incidents].sort((a,b) => Number(a.time || 0) - Number(b.time || 0)).map((item, i) =>
        <div key={item.id || i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3 text-xs">
          <span className="w-12 shrink-0 font-black tabular-nums text-brand">{digits(item.time)}′</span>
          <span className="flex-1 text-white/75">{String(item.type || "Event")} {item.playerName ? "· " + item.playerName : ""} {item.detail ? "· " + item.detail : ""}</span>
          <span className="text-white/40">{item.isHome === true ? home : item.isHome === false ? away : ""}</span>
        </div>)}</div> : <Empty title={t("رویدادی ثبت نشده", "No verified events yet")} description={t("گل‌ها، کارت‌ها و تعویض‌ها پس از دریافت اطلاعات ثبت می‌شوند.", "Goals, cards and substitutions appear once ingested.")} />) :
      selected === "lineups" ? <PitchLineup lineups={live?.lineups ?? null} match={match} language={language} t={t} incidents={incidents} /> :
      selected === "form" ? <><div className="grid gap-3 sm:grid-cols-2"><FormStrip fixtures={local?.form?.home ?? []} name={home} t={t} /><FormStrip fixtures={local?.form?.away ?? []} name={away} t={t} /></div><p className="mt-4 text-xs leading-5 text-white/45">{t("پوشش محدود به نتایج ذخیره‌شده است.", "Coverage is limited to matches stored in LowBlock.")}</p></> :
      selected === "h2h" ? meetings.length ? <div className="space-y-2">{meetings.slice(0, 10).map((meeting: any) => <div key={meeting.fixtureId} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-xs">
        <span className="text-white/45">{new Date(meeting.date).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB")}</span>
        <span className="min-w-0 flex-1 truncate text-center">{meeting.homeTeam?.name} <b className="mx-2 text-brand">{meeting.homeGoals} : {meeting.awayGoals}</b> {meeting.awayTeam?.name}</span>
      </div>)}</div> : <Empty title={t("سابقه تقابل موجود نیست", "No historical meetings found")} description={t("فقط دیدارهای موجود در داده‌های ثبت‌شده نمایش داده می‌شوند.", "Only verified meetings in imported match history are included.")} /> :
      verifiedStandings.length ? <div className="space-y-2">{verifiedStandings.map((entry: any, i: number) =>
        <div key={entry.team?.id ?? i} className="grid grid-cols-[2rem_1fr_3rem_3rem] items-center gap-2 border-b border-white/10 py-2 text-xs">
          <span className="text-white/45">{entry.rank}</span><span className="truncate">{entry.team?.name}</span>
          <span className="text-center text-white/55">{entry.played ?? "–"}</span><span className="text-center font-black text-brand">{entry.points ?? "–"}</span>
        </div>)}</div> : <Empty title={t("جدول لیگ هنوز تأیید نشده", "League standings not verified")} description={t("برای نمایش جدول واقعی، داده کامل فصل یا جدول رسمی ارائه‌دهنده لازم است. جدول پیش‌بینی کاربران جایگزین نمی‌شود.", "A real league table requires complete season results or verified provider standings. Prediction rankings are never substituted.")} />}
    </div>
  </section>;
}
