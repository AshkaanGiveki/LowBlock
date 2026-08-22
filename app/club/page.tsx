"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type Club = { _id: string; name: string; state: "FORMING" | "ACTIVE"; discoveryMode: string; activatedAt: string | null };
export default function ClubPage() {
  const { t } = useLanguage(); const [club, setClub] = useState<Club | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/clubs").then(r => r.json()).then(data => setClub(data.club)).finally(() => setLoading(false)); }, []);
  if (loading) return <main className="min-h-screen px-5 pb-28 pt-28"><div className="mx-auto max-w-3xl animate-pulse rounded-3xl bg-white/5 p-12" /></main>;
  return <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-3xl"><section className="rounded-3xl border border-white/[.08] bg-[linear-gradient(145deg,#14251c,#0a0f0c)] p-7 md:p-10"><p className="text-xs font-black tracking-[.2em] text-brand">{t("باشگاه من", "YOUR CLUB")}</p>{club ? <><h1 className="mt-2 text-4xl font-black">{club.name}</h1><span className="mt-4 inline-flex rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-black text-brand">{club.state === "ACTIVE" ? t("فعال", "ACTIVE") : t("در حال شکل‌گیری", "FORMING")}</span><div className="mt-8 grid gap-3 sm:grid-cols-3"><Link href={`/club/${club._id}/match-centre`} className="rounded-xl bg-brand px-4 py-3 text-center text-sm font-black">{t("مرکز مسابقات", "Match Centre")}</Link><Link href={`/club/${club._id}/members`} className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-black">{t("اعضا", "Members")}</Link><Link href={`/club/${club._id}/settings`} className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-black">{t("مدیریت", "Manage")}</Link></div></> : <><h1 className="mt-2 text-3xl font-black">{t("هنوز عضو باشگاهی نیستید", "You are not representing a Club yet")}</h1><p className="mt-3 text-sm text-[var(--muted)]">{t("یک باشگاه بسازید یا باشگاه در حال جذب پیدا کنید.", "Create a Club or find one that is recruiting.")}</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/club/create" className="rounded-xl bg-brand px-5 py-3 text-sm font-black">{t("ساخت باشگاه", "Create Club")}</Link><Link href="/club/discover" className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black">{t("پیدا کردن باشگاه", "Find a Club")}</Link></div></>}</section></div></main>;
}

