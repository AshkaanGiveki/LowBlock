"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Crown, Shield, Sparkles, Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type Club = {
  _id: string;
  name: string;
  state: "FORMING" | "ACTIVE";
  discoveryMode: string;
  activatedAt: string | null;
};

type Performance = { rank: number | null; points: number; exact: number; roundWins: number };

export default function ClubPage() {
  const { t } = useLanguage();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState(0);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clubs")
      .then((response) => response.json())
      .then((data) => {
        setClub(data.club);
        setMembers(data.members ?? 0);
        setPerformance(data.performance ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="min-h-screen px-5 pb-28 pt-28"><div className="mx-auto max-w-3xl animate-pulse rounded-3xl bg-white/5 p-16" /></main>;

  return <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-4xl">
    {club ? <>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[.08] bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.26),transparent_38%),linear-gradient(145deg,#14251c,#0a0f0c)] p-7 md:p-10">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand"><Shield size={14} />{club.state === "ACTIVE" ? t("باشگاه فعال", "ACTIVE CLUB") : t("در حال شکل‌گیری", "FORMING")}</div>
          <h1 className="mt-4 text-4xl font-black md:text-5xl">{club.name}</h1>
          <p className="mt-3 text-sm text-white/60">{members} {t("عضو · یک هویت، هر لیگ", "members · one identity, every league")}</p>
        </div><Link href={`/club/${club._id}/settings`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-black hover:border-brand/50">{t("مدیریت باشگاه", "Manage Club")}<ArrowUpRight size={16} /></Link></div>
      </section>
      <nav className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#101512] p-2"><Link href="/club" className="rounded-xl bg-brand/15 px-3 py-3 text-center text-xs font-black text-brand">{t("نمای کلی", "Overview")}</Link><Link href={`/club/${club._id}/match-centre`} className="rounded-xl px-3 py-3 text-center text-xs font-black text-[var(--muted)] hover:bg-white/5">{t("مرکز مسابقات", "Match Centre")}</Link><Link href={`/club/${club._id}/members`} className="rounded-xl px-3 py-3 text-center text-xs font-black text-[var(--muted)] hover:bg-white/5">{t("اعضا", "Members")}</Link></nav>
      <section className="mt-4 grid gap-4 md:grid-cols-[1.2fr_.8fr]"><div className="rounded-3xl border border-white/10 bg-[#101512] p-6"><div className="flex items-center gap-2 text-brand"><Sparkles size={18} /><p className="text-xs font-black tracking-[.16em]">YOUR PERFORMANCE</p></div><h2 className="mt-3 text-2xl font-black">{t("رقابت شما در باشگاه", "Your Club performance")}</h2><div className="mt-6 grid grid-cols-2 gap-3"><Stat label={t("رتبه باشگاه", "Club rank")} value={performance?.rank ? `#${performance.rank}` : "—"} /><Stat label={t("امتیاز فصل", "Season points")} value={String(performance?.points ?? 0)} /><Stat label={t("برد دوره‌ها", "Round wins")} value={String(performance?.roundWins ?? 0)} /><Stat label={t("پیش‌بینی دقیق", "Exact picks")} value={String(performance?.exact ?? 0)} /></div></div><div className="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,#18271f,#0c120f)] p-6"><Crown className="text-[#e8c66a]" size={22} /><h2 className="mt-4 text-2xl font-black">{club.state === "ACTIVE" ? t("رقابت شروع شده", "Competition is live") : t("یک قدم تا شروع", "One more step")}</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{club.state === "ACTIVE" ? t("تمام لیگ‌های پشتیبانی‌شده برای باشگاه شما فعال هستند.", "Every supported league is automatically available to your Club.") : t(`برای فعال‌شدن باشگاه به ${Math.max(0, 3 - members)} عضو دیگر نیاز دارید.`, `Your Club needs ${Math.max(0, 3 - members)} more member(s) to activate.`)}</p><Link href={`/club/${club._id}/members`} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand">{t("مشاهده اعضا", "View members")}<ArrowUpRight size={15} /></Link></div></section>
    </> : <section className="overflow-hidden rounded-[2rem] border border-white/[.08] bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.2),transparent_38%),linear-gradient(145deg,#14251c,#0a0f0c)] p-7 md:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-brand"><Users size={25} /></div><p className="mt-6 text-xs font-black tracking-[.2em] text-brand">YOUR CLUB</p><h1 className="mt-2 text-3xl font-black md:text-4xl">{t("هنوز باشگاهی را نمایندگی نمی‌کنید", "You are not representing a Club yet")}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{t("عضویت در باشگاه اختیاری است؛ رقابت جهانی LowBlock برای شما همین حالا فعال است.", "Club membership is optional. Your global LowBlock competition is already active.")}</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/club/create" className="rounded-xl bg-brand px-5 py-3 text-sm font-black">{t("ساخت باشگاه", "Create Club")}</Link><Link href="/club/discover" className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black">{t("پیدا کردن باشگاه", "Find a Club")}</Link></div></section>}
  </div></main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-black/20 p-3"><b className="block text-2xl text-brand">{value}</b><small className="text-[10px] text-[var(--muted)]">{label}</small></div>; }
