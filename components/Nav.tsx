"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  Globe2,
  Home,
  Target,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { UserAvatar } from "@/components/UserAvatar";

const routes = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/matches", icon: Target, label: "Predict" },
  { href: "/club", icon: UsersRound, label: "Club" },
  { href: "/lowblock", icon: Trophy, label: "Leaderboard" },
];

export function Nav() {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isDefendingChampion, setIsDefendingChampion] = useState(false);
  const [clubImage, setClubImage] = useState<string | null>(null);
  const fa = language === "fa";
  useEffect(() => setLoading(false), [pathname]);
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((response) => response.json()),
      fetch("/api/clubs").then((response) => response.json()),
    ])
      .then(([me, club]) => {
        setAvatar(me.user?.avatarUrl ?? null);
        setIsDefendingChampion(Boolean(me.user?.isDefendingChampion));
        setClubImage(club.club?.imageUrl ?? null);
      })
      .catch(() => undefined);
  }, [pathname]);
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const navIcon = (Icon: typeof Home, selected: boolean) => (
    <motion.span
      animate={{ y: selected ? -1 : 0, scale: selected ? 1.04 : 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className="relative z-10"
    >
      <Icon size={21} strokeWidth={selected ? 2.5 : 1.9} />
    </motion.span>
  );
  const clubIcon =
    active("/club") && clubImage ? (
      <span className="club-crest-glow relative z-10 grid h-8 w-8 place-items-center rounded-full p-[2px]">
        <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#101812] p-1">
          <img
            src={clubImage}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        </span>
      </span>
    ) : (
      navIcon(UsersRound, active("/club"))
    );
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-[70px] border-b border-white/[.07] bg-[#080b0a]/85 backdrop-blur-2xl">
        <div className="relative mx-auto h-full max-w-7xl px-5 md:px-8">
          <LanguageMenu language={language} setLanguage={setLanguage} fa={fa} />
        </div>
        {loading && (
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.32 }}
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand"
          />
        )}
      </header>
      <nav className="bottom-nav-dock fixed inset-x-3 z-50 flex items-center justify-around lg:hidden">
        {routes.map(({ href, icon: Component, label }) => (
          <Link
            key={href}
            href={href}
            aria-label={
              fa
                ? (
                    {
                      Home: "خانه",
                      Predict: "پیش‌بینی",
                      Club: "باشگاه",
                      Leaderboard: "جدول امتیازات",
                    } as Record<string, string>
                  )[label]
                : label
            }
            onClick={() => href !== pathname && setLoading(true)}
            className={`relative grid h-11 w-12 place-items-center rounded-lg transition ${active(href) ? "text-brand" : "text-[var(--muted)]"}`}
          >
            {active(href) && (
              <motion.span
                layoutId="mobile-nav-active"
                className="bottom-nav-active-indicator absolute inset-1 rounded-[1.1rem] bg-brand/15"
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
              />
            )}{" "}
            {href === "/club" ? clubIcon : navIcon(Component, active(href))}
          </Link>
        ))}
        <Link
          href="/profile"
          aria-label={fa ? "پروفایل" : "Profile"}
          onClick={() => pathname !== "/profile" && setLoading(true)}
          className={`relative grid h-11 w-12 place-items-center rounded-lg ${active("/profile") ? "text-brand" : "text-[var(--muted)]"}`}
        >
          {active("/profile") && (
            <motion.span
              layoutId="mobile-nav-active"
              className="bottom-nav-active-indicator absolute inset-1 rounded-[1.1rem] bg-brand/15"
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
            />
          )}{" "}
          {avatar ? (
            <motion.img
              animate={{ y: active("/profile") ? 2 : 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
              src={avatar}
              alt="Profile"
              className="relative z-10 h-7 w-7 rounded-full object-cover"
            />
          ) : (
            navIcon(UserRound, active("/profile"))
          )}
        </Link>
      </nav>
    </>
  );
}

function LanguageMenu({
  language,
  setLanguage,
  fa,
}: {
  language: "fa" | "en";
  setLanguage: (value: "fa" | "en") => void;
  fa: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = [
    { code: "fa" as const, flag: "🇮🇷", native: "فارسی", label: "Persian" },
    { code: "en" as const, flag: "🇬🇧", native: "English", label: "English" },
  ];
  const current = options.find((option) => option.code === language)!;
  return (
    <div className="language-menu absolute top-1/2 -translate-y-1/2">
      <button
        type="button"
        aria-label="Change language"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group inline-flex h-10 items-center gap-2 rounded-2xl border border-brand/25 bg-[linear-gradient(145deg,rgba(32,184,121,.16),rgba(255,255,255,.04))] px-3 text-xs font-black text-white shadow-[0_8px_25px_rgba(0,0,0,.2)] transition hover:border-brand/60 hover:bg-brand/15"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.native}</span>
        <span className="text-[10px] tracking-[.12em] text-brand">
          {language.toUpperCase()}
        </span>
        <ChevronDown
          size={14}
          className={`text-brand transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            className={`absolute top-12 w-52 overflow-hidden rounded-2xl border border-brand/25 bg-[#101812]/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-2xl ${fa ? "right-0" : "left-0"}`}
          >
            <p className="px-3 pb-2 pt-1 text-[9px] font-black tracking-[.18em] text-white/35">
              LANGUAGE
            </p>
            {options.map((option) => (
              <button
                type="button"
                key={option.code}
                onClick={() => {
                  setLanguage(option.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition ${option.code === language ? "bg-brand/15 text-brand" : "text-white/70 hover:bg-white/[.06]"}`}
              >
                <span className="text-lg">{option.flag}</span>
                <span className="flex-1">
                  <b className="block text-xs">{option.native}</b>
                  <small className="text-[10px] text-white/35">
                    {option.label}
                  </small>
                </span>
                {option.code === language && (
                  <span className="h-2 w-2 rounded-full bg-brand shadow-[0_0_10px_rgba(32,184,121,.8)]" />
                )}
              </button>
            ))}
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[10px] text-white/35">
              <Globe2 size={13} />
              <span>
                {fa ? "زبان‌های بیشتر به‌زودی" : "More languages soon"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
