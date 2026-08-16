"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Goal, Home, LogIn, Trophy } from "lucide-react";
import { Brand } from "@/components/Brand";
import { useLanguage } from "@/components/LanguageProvider";

type User = { username: string; avatarUrl: string | null };
const routes = [{ href: "/app", fa: "خانه", en: "Home", icon: Home }, { href: "/leagues/GB1", fa: "لیگ‌ها", en: "Leagues", icon: Trophy }, { href: "/predictions", fa: "پیش‌بینی‌ها", en: "Predictions", icon: Goal }, { href: "/leaderboard", fa: "رتبه‌بندی", en: "Leaders", icon: BarChart3 }];
function initials(name: string) { const parts = name.trim().split(/\s+/).filter(Boolean); const chars = parts.length > 1 ? [parts[0][0], parts[1][0]] : [...(parts[0] ?? "ک")].slice(0, 2); return chars.join("‌").toUpperCase(); }

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const { language, setLanguage, t } = useLanguage();
  const authPage = pathname === "/login" || pathname === "/signup";
  useEffect(() => { setPendingPath(null); }, [pathname]);
  useEffect(() => { fetch("/api/auth/me").then((response) => response.json()).then((data) => setUser(data.user ?? null)).catch(() => setUser(null)); }, [pathname]);
  const active = (href: string) => { const current = pendingPath ?? pathname; return href === "/app" ? current === "/app" : href === "/leagues/GB1" ? current.startsWith("/leagues") : current.startsWith(href); };
  const navigate = (href: string) => { if (href !== pathname) setPendingPath(href); };
  const avatar = <span className="relative z-10 grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-brand/20 text-[9px] font-black text-white">{user?.avatarUrl ? <img src={user.avatarUrl} alt={user.username} className="h-full w-full object-cover" /> : user ? initials(user.username) : <LogIn size={14} />}</span>;
  const labels = useMemo(() => ({ space: t("فضای پیش‌بینی", "PREDICTION SPACE"), account: t("حساب", "Account"), login: t("ورود به حساب", "Sign in"), footer: t("لوبلاک · پیش‌بینی مسئولانه فوتبال", "LowBlock · Responsible football predictions") }), [t]);
  const NavLink = ({ href, fa, en, Icon, mobile = false }: { href: string; fa: string; en: string; Icon: typeof Home; mobile?: boolean }) => <Link href={href} onClick={() => navigate(href)} className={`relative flex ${mobile ? "min-w-[54px] flex-col items-center gap-1 rounded-2xl px-1.5 py-2 text-[9px]" : "items-center gap-3 rounded-2xl px-4 py-3.5 text-sm"} font-bold ${active(href) ? "text-white" : "text-[var(--muted)] hover:bg-white/[.04] hover:text-white"}`}>{active(href) && <motion.span layoutId={mobile ? "active-mobile-nav" : "active-desktop-nav"} className={`absolute inset-0 ${mobile ? "rounded-2xl bg-brand/20" : "rounded-2xl bg-brand/15"}`} transition={{ type: "spring", stiffness: 380, damping: 32 }} />}{active(href) && !mobile && <motion.span layoutId="active-desktop-line" className="absolute right-0 h-7 w-1 rounded-full bg-brand" />}{active(href) && mobile && <motion.span layoutId="active-mobile-dot" className="absolute -top-1 h-1 w-5 rounded-full bg-brand" />}<span className="relative z-10 flex items-center gap-3"><Icon size={mobile ? 18 : 18} />{mobile ? <span>{language === "fa" ? fa : en}</span> : <span>{language === "fa" ? fa : en}</span>}</span></Link>;
  return <>
    <AnimatePresence>{pendingPath && !authPage && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[45] pointer-events-none bg-[#050706]/35 backdrop-blur-[2px] md:right-72"><div className="mx-auto mt-28 max-w-2xl px-5"><div className="h-2 w-32 animate-pulse bg-brand/40" /><div className="mt-5 h-24 animate-pulse bg-white/[.06]" /><div className="mt-3 h-5 w-2/3 animate-pulse bg-white/[.05]" /></div></motion.div>}</AnimatePresence>
    {!authPage && <aside className="fixed inset-y-0 right-0 z-40 hidden w-72 border-l border-white/[.07] bg-[#09090c]/92 px-5 py-7 backdrop-blur-2xl md:block"><Brand variant="stacked" className="mb-12" /><p className="mb-4 px-3 text-[10px] font-bold tracking-[.22em] text-[var(--muted)]">{labels.space}</p><nav className="space-y-2">{routes.map(({ href, fa, en, icon: Icon }) => <NavLink key={href} href={href} fa={fa} en={en} Icon={Icon} />)}</nav><Link href={user ? "/predictions" : "/login"} className="absolute bottom-14 left-5 right-5 flex items-center gap-3 bg-white/[.03] px-4 py-3 text-sm font-bold text-white">{avatar}<span className="truncate">{user?.username ?? labels.login}</span></Link></aside>}
    <header className={`fixed inset-x-0 top-0 z-50 flex h-[72px] items-center justify-between border-b border-white/[.07] bg-[#07070a]/78 px-5 backdrop-blur-2xl ${authPage ? "md:px-10" : "md:pr-[20rem] md:pl-8"}`}><Brand variant="horizontal" /><div className="flex border border-white/10 bg-white/[.04] p-1 text-[10px] font-black"><button onClick={() => setLanguage("fa")} className={`px-2.5 py-1.5 transition ${language === "fa" ? "bg-brand text-white" : "text-[var(--muted)]"}`}>FA</button><button onClick={() => setLanguage("en")} className={`px-2.5 py-1.5 transition ${language === "en" ? "bg-brand text-white" : "text-[var(--muted)]"}`}>EN</button></div></header>
    {!authPage && <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around border border-white/10 bg-[#111116]/94 px-1 py-1.5 shadow-2xl backdrop-blur-2xl md:hidden">{routes.map(({ href, fa, en, icon: Icon }) => <NavLink key={href} href={href} fa={fa} en={en} Icon={Icon} mobile />)}<Link href={user ? "/predictions" : "/login"} className="relative flex min-w-[54px] flex-col items-center gap-1 px-1.5 py-2 text-[9px] font-bold text-[var(--muted)]">{avatar}<span className="max-w-12 truncate">{user ? user.username : labels.account}</span></Link></nav>}
    {!authPage && <footer className="fixed bottom-0 left-0 right-72 z-20 hidden h-8 items-center justify-center border-t border-white/[.05] bg-[#07070a]/80 text-[10px] text-[var(--muted)] backdrop-blur-xl md:flex">{labels.footer}</footer>}
  </>;
}
