"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CircleHelp,
  Home,
  Languages,
  Settings2,
  Target,
  Trophy,
  UsersRound,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { Brand } from "@/components/Brand";
import { useLanguage } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";

const items = [
  { href: "/", icon: Home, fa: "خانه", en: "Home" },
  { href: "/matches", icon: Target, fa: "پیش‌بینی‌ها", en: "Predictions" },
  { href: "/club", icon: UsersRound, fa: "باشگاه من", en: "My club" },
  {
    href: "/lowblock",
    icon: Trophy,
    fa: "رده‌بندی جهانی",
    en: "Global ranking",
  },
];

export function DesktopNavigation() {
  const pathname = usePathname();
  const { setLanguage, t, language } = useLanguage();
  const { data } = useQuery({
    queryKey: ["navigation-context"],
    queryFn: async () => {
      const [me, club] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/clubs"),
      ]);
      return { me: await me.json(), club: await club.json() };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const avatar = data?.me?.user?.avatarUrl ?? null;
  const clubImage = data?.club?.club?.imageUrl ?? null;
  const champion = Boolean(data?.me?.user?.isDefendingChampion);
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  if (pathname === "/login" || pathname === "/signup") return null;
  return (
    <aside
      className="desktop-rail"
      aria-label={t("ناوبری اصلی", "Primary navigation")}
    >
      <div className="desktop-rail-inner">
        <Link href="/" className="desktop-rail-brand">
          <Brand variant="mark" className="h-11 w-11" />
          <span>
            <b>LowBlock</b>
            <small>{t("رقابت فوتبالی شما", "Football competition")}</small>
          </span>
        </Link>
        <div className="desktop-rail-section-label">
          {t("فضای رقابت", "COMPETE")}
        </div>
        <nav className="desktop-rail-nav">
          {items.map(({ href, icon: Icon, fa, en }) => (
            <Link
              href={href}
              key={href}
              className={`desktop-rail-link ${active(href) ? "is-active" : ""}`}
            >
              <span className="desktop-rail-link-icon">
                {href === "/club" && active(href) && clubImage ? (
                  <Image src={clubImage} alt="" width={24} height={24} />
                ) : (
                  <Icon size={19} strokeWidth={active(href) ? 2.5 : 1.8} />
                )}
              </span>
              <span>{language === "fa" ? fa : en}</span>
              {active(href) && (
                <motion.span
                  layoutId="desktop-rail-active"
                  className="desktop-rail-active"
                />
              )}
            </Link>
          ))}
        </nav>
        <div className="desktop-rail-section-label">
          {t("فضای شخصی", "PERSONAL")}
        </div>
        <nav className="desktop-rail-nav">
          <Link
            href="/profile"
            className={`desktop-rail-link ${active("/profile") ? "is-active" : ""}`}
          >
            <span className="desktop-rail-link-icon">
              {avatar || champion ? (
                <UserAvatar
                  name="Profile"
                  avatarUrl={avatar}
                  isDefendingChampion={champion}
                  className="h-7 w-7 text-[8px]"
                />
              ) : (
                <UserRound size={19} />
              )}
            </span>
            <span>{t("پروفایل", "Profile")}</span>
            {active("/profile") && (
              <motion.span
                layoutId="desktop-rail-active"
                className="desktop-rail-active"
              />
            )}
          </Link>
          <Link
            href="/help"
            className={`desktop-rail-link ${active("/help") ? "is-active" : ""}`}
          >
            <span className="desktop-rail-link-icon">
              <CircleHelp size={19} />
            </span>
            <span>{t("راهنما", "Help")}</span>
            {active("/help") && (
              <motion.span
                layoutId="desktop-rail-active"
                className="desktop-rail-active"
              />
            )}
          </Link>
        </nav>
        <div className="desktop-rail-spacer" />
        <div className="desktop-rail-status">
          <span className="desktop-live-dot" />
          <span>
            <b>{t("همه‌چیز آماده است", "All systems ready")}</b>
            <small>{t("رقابت ادامه دارد", "Competition is live")}</small>
          </span>
          <BarChart3 size={17} className="text-brand" />
        </div>
        <div className="desktop-rail-footer">
          <button
            type="button"
            onClick={() => setLanguage(language === "fa" ? "en" : "fa")}
          >
            <Languages size={16} />
            {language === "fa" ? "English" : "فارسی"}
          </button>
          <Link href="/profile">
            <Settings2 size={16} />
            {t("تنظیمات حساب", "Account settings")}
          </Link>
        </div>
      </div>
    </aside>
  );
}
