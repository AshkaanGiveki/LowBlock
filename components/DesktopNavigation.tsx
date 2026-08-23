"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Home, Languages, Settings2, Target, Trophy, UsersRound, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { Brand } from "@/components/Brand";
import { useLanguage } from "@/components/LanguageProvider";

const items = [
  { href: "/", icon: Home, fa: "خانه", en: "Home" },
  { href: "/matches", icon: Target, fa: "پیش‌بینی", en: "Predict" },
  { href: "/club", icon: UsersRound, fa: "باشگاه", en: "Club" },
  { href: "/lowblock", icon: Trophy, fa: "جدول امتیازات", en: "Leaderboard" },
];

export function DesktopNavigation() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [clubImage, setClubImage] = useState<string | null>(null);
  const fa = language === "fa";
  const authPage = pathname === "/login" || pathname === "/signup";
  useEffect(() => { Promise.all([fetch("/api/auth/me").then((response) => response.json()), fetch("/api/clubs").then((response) => response.json())]).then(([me, club]) => { setAvatar(me.user?.avatarUrl ?? null); setClubImage(club.club?.imageUrl ?? null); }).catch(() => undefined); }, [pathname]);
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  if (authPage) return null;
  return <aside className="desktop-rail" aria-label={t("ناوبری اصلی", "Primary navigation")}><div className="desktop-rail-inner">
    <Link href="/" className="desktop-rail-brand"><Brand variant="mark" className="h-11 w-11" /><span><b>LowBlock</b><small>{t("رقابت فوتبالی شما", "Football competition")}</small></span></Link>
    <div className="desktop-rail-section-label">{t("فضای رقابت", "COMPETE")}</div>
    <nav className="desktop-rail-nav">{items.map(({ href, icon: Icon, fa: faLabel, en }) => <Link href={href} key={href} className={`desktop-rail-link ${active(href) ? "is-active" : ""}`}><span className="desktop-rail-link-icon">{href === "/club" && active(href) && clubImage ? <img src={clubImage} alt="" /> : <Icon size={19} strokeWidth={active(href) ? 2.5 : 1.8} />}</span><span>{fa ? faLabel : en}</span>{active(href) && <motion.span layoutId="desktop-rail-active" className="desktop-rail-active" />}</Link>)}</nav>
    <div className="desktop-rail-section-label">{t("فضای شخصی", "PERSONAL")}</div>
    <nav className="desktop-rail-nav"><Link href="/profile" className={`desktop-rail-link ${active("/profile") ? "is-active" : ""}`}><span className="desktop-rail-link-icon">{avatar ? <img src={avatar} alt="" /> : <UserRound size={19} />}</span><span>{t("پروفایل", "Profile")}</span>{active("/profile") && <motion.span layoutId="desktop-rail-active" className="desktop-rail-active" />}</Link></nav>
    <div className="desktop-rail-spacer" />
    <div className="desktop-rail-status"><span className="desktop-live-dot" /><span><b>{t("همه‌چیز آماده است", "All systems ready")}</b><small>{t("رقابت ادامه دارد", "Competition is live")}</small></span><BarChart3 size={17} className="text-brand" /></div>
    <div className="desktop-rail-footer"><button type="button" onClick={() => setLanguage(fa ? "en" : "fa")}><Languages size={16} />{fa ? "English" : "فارسی"}</button><Link href="/profile"><Settings2 size={16} />{t("تنظیمات حساب", "Account settings")}</Link></div>
  </div></aside>;
}
