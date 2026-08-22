"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, BarChart3, Goal, Home, UserRound, Users } from "lucide-react";
import { Brand } from "@/components/Brand";
import { useLanguage } from "@/components/LanguageProvider";

const routes = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/matches", icon: Goal, label: "Predict" },
  { href: "/club", icon: Users, label: "Club" },
  { href: "/lowblock", icon: BarChart3, label: "Leaderboard" },
];

export function Nav() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const fa = language === "fa";
  const authPage = pathname === "/login" || pathname === "/signup";
  const bottomPage = pathname === "/" || pathname === "/matches" || pathname === "/club" || pathname === "/lowblock" || pathname === "/profile";
  useEffect(() => setLoading(false), [pathname]);
  useEffect(() => { if (authPage) return; fetch("/api/auth/me").then(r => r.json()).then(data => setAvatar(data.user?.avatarUrl ?? null)).catch(() => {}); }, [authPage, pathname]);
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const Icon = fa ? ArrowRight : ArrowLeft;
  const localeLabel = fa ? "EN" : "فا";
  const navIcon = (Component: typeof Home, selected: boolean) => <motion.span animate={{ y: selected ? 2 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} className="relative z-10"><Component size={23} /></motion.span>;
  return <>
    <header className="fixed inset-x-0 top-0 z-50 h-[70px] border-b border-white/[.07] bg-[#080b0a]/85 backdrop-blur-2xl"><div className="relative mx-auto h-full max-w-7xl px-5 md:px-8"><Brand variant="mark" className={`absolute top-1/2 h-10 w-10 -translate-y-1/2 ${fa ? "right-5 md:right-8" : "left-5 md:left-8"}`} /><Link href="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><img src="/lowblock-typo.png" alt="LowBlock" className="h-auto w-28 object-contain" /></Link>{!authPage && !bottomPage && <button type="button" onClick={() => history.back()} aria-label={t("بازگشت", "Back")} className={`absolute top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-bold text-[var(--muted)] hover:border-brand/40 hover:text-brand ${fa ? "left-5 md:left-8" : "right-5 md:right-8"}`}><Icon size={15} />{t("بازگشت", "Back")}</button>}{(authPage || bottomPage) && <button aria-label="Change language" onClick={() => setLanguage(fa ? "en" : "fa")} className={`absolute top-1/2 grid h-9 min-w-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-white/[.05] px-2 text-xs font-black text-white transition hover:border-brand hover:text-brand ${fa ? "left-5 md:left-8" : "right-5 md:right-8"}`}>{localeLabel}</button>}</div>{loading && <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .32 }} className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand" />}</header>
    {!authPage && <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-xl border border-white/10 bg-[#151b18]/95 px-1 py-1.5 shadow-2xl backdrop-blur-2xl lg:hidden">{routes.map(({ href, icon: Component, label }) => <Link key={href} href={href} aria-label={label} onClick={() => href !== pathname && setLoading(true)} className={`relative grid h-11 w-12 place-items-center rounded-lg transition ${active(href) ? "text-brand" : "text-[var(--muted)]"}`}>{active(href) && <motion.span layoutId="mobile-nav-active" className="absolute inset-0 rounded-lg bg-brand/15" transition={{ type: "spring", stiffness: 520, damping: 34 }} />}{navIcon(Component, active(href))}</Link>)}<Link href="/profile" aria-label="Profile" onClick={() => pathname !== "/profile" && setLoading(true)} className={`relative grid h-11 w-12 place-items-center rounded-lg ${active("/profile") ? "text-brand" : "text-[var(--muted)]"}`}>{active("/profile") && <motion.span layoutId="mobile-nav-active" className="absolute inset-0 rounded-lg bg-brand/15" transition={{ type: "spring", stiffness: 520, damping: 34 }} />}{avatar ? <motion.img animate={{ y: active("/profile") ? 2 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} src={avatar} alt="Profile" className="relative z-10 h-7 w-7 rounded-full object-cover" /> : navIcon(UserRound, active("/profile"))}</Link></nav>}
  </>;
}
