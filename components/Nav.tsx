"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Goal, Home, LogIn, Trophy } from "lucide-react";
import { Brand } from "@/components/Brand";
import { useLanguage } from "@/components/LanguageProvider";

type User = { username: string; avatarUrl: string | null };
const routes = [
  { href: "/app", fa: "\u062e\u0627\u0646\u0647", en: "Home", icon: Home },
  { href: "/leagues/GB1", fa: "\u0644\u06cc\u06af\u200c\u0647\u0627", en: "Leagues", icon: Trophy },
  { href: "/predictions", fa: "\u067e\u06cc\u0634\u200c\u0628\u06cc\u0646\u06cc\u200c\u0647\u0627", en: "Predictions", icon: Goal },
  { href: "/leaderboard", fa: "\u0631\u062a\u0628\u0647\u200c\u0628\u0646\u062f\u06cc", en: "Leaders", icon: BarChart3 },
];

export function Nav() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const authPage = pathname === "/login" || pathname === "/signup";
  const appPage = pathname !== "/" && !authPage;
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((data) => setUser(data.user ?? null)).catch(() => setUser(null)); }, [pathname]);
  const active = (href: string) => href === "/app" ? pathname === href : href === "/leagues/GB1" ? pathname.startsWith("/leagues") : pathname.startsWith(href);
  const labels = useMemo(() => ({ login: t("\u0648\u0631\u0648\u062f", "Sign in"), account: t("\u062d\u0633\u0627\u0628", "Account") }), [t]);
  return <>
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[.07] bg-[#080b0a]/82 backdrop-blur-2xl"><div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between px-5 md:px-8"><Brand variant="horizontal" />
      {!authPage && <nav className="hidden items-center gap-1 rounded-2xl border border-white/[.07] bg-white/[.025] p-1 lg:flex">{routes.map(({ href, fa, en }) => <Link key={href} href={href} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${active(href) ? "bg-brand text-white shadow-sm" : "text-[var(--muted)] hover:bg-white/[.06] hover:text-white"}`}>{language === "fa" ? t(fa, en) : en}</Link>)}</nav>}
      <div className="flex items-center gap-2"><div className="flex rounded-xl border border-white/10 bg-white/[.04] p-1 text-[10px] font-black"><button aria-label="Persian" onClick={() => setLanguage("fa")} className={`rounded-lg px-2.5 py-1.5 ${language === "fa" ? "bg-brand text-white" : "text-[var(--muted)]"}`}>FA</button><button aria-label="English" onClick={() => setLanguage("en")} className={`rounded-lg px-2.5 py-1.5 ${language === "en" ? "bg-brand text-white" : "text-[var(--muted)]"}`}>EN</button></div>{!authPage && <Link href={user ? "/predictions" : "/login"} className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-bold text-white sm:flex"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand/20 text-[9px] text-brand">{user?.username?.slice(0, 1).toUpperCase() ?? <LogIn size={12} />}</span>{user?.username ?? labels.login}</Link>}</div>
    </div></header>
    {appPage && <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-2xl border border-white/10 bg-[#151b18]/95 px-1 py-1.5 shadow-2xl backdrop-blur-2xl lg:hidden">{routes.map(({ href, fa, en, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-bold ${active(href) ? "bg-brand/15 text-brand" : "text-[var(--muted)]"}`}><Icon size={18}/><span>{language === "fa" ? t(fa, en) : en}</span></Link>)}<Link href={user ? "/predictions" : "/login"} className="flex min-w-[54px] flex-col items-center gap-1 px-1 py-2 text-[9px] font-bold text-[var(--muted)]"><LogIn size={18}/><span>{labels.account}</span></Link></nav>}
  </>;
}
