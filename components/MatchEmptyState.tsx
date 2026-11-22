"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Trophy,
  WifiOff,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "./MatchEmptyState.module.css";

export type MatchEmptyVariant =
  "upcoming" | "live" | "results" | "filtered" | "complete" | "error";
const copy = {
  upcoming: {
    icon: CalendarDays,
    label: ["فرصت بعدی", "NEXT UP"],
    title: ["منتظر سوت شروع بعدی", "The next whistle is coming."],
    description: [
      "در حال حاضر مسابقه‌ای برای پیش‌بینی باز نیست. برنامه بازی‌ها را ببین و برای فرصت بعدی آماده باش.",
      "No fixtures are open for predictions right now. Explore the competitions and get ready for your next pick.",
    ],
  },
  live: {
    icon: Radio,
    label: ["کنار زمین", "ON THE TOUCHLINE"],
    title: ["فعلاً توپ در بازی نیست", "A breather between matches."],
    description: [
      "در حال حاضر مسابقه زنده‌ای در این برنامه نیست. تا شروع بازی بعدی، پیش‌بینی‌هایت را ثبت کن.",
      "No matches are live in this schedule right now. Get your next predictions in before kick-off.",
    ],
  },
  results: {
    icon: Trophy,
    label: ["پس از سوت پایان", "AFTER THE FINAL WHISTLE"],
    title: ["داستان بازی هنوز تمام نشده", "The story is still being written."],
    description: [
      "هنوز نتیجه‌ای در این برنامه ثبت نشده است. پس از پایان مسابقه‌ها، نتایج اینجا نمایش داده می‌شوند.",
      "No results in this schedule yet. Finished matches will appear here once the final scores are in.",
    ],
  },
  filtered: {
    icon: SlidersHorizontal,
    label: ["انتخاب مسابقه", "YOUR MATCH SELECTION"],
    title: ["دایره انتخابت را بازتر کن", "Widen the playing field."],
    description: [
      "مسابقه‌ای با این فیلترها پیدا نشد. همه رقابت‌ها را نمایش بده یا وضعیت دیگری را انتخاب کن.",
      "No fixtures fit these filters. Show every competition or switch to another match status.",
    ],
  },
  complete: {
    icon: CheckCheck,
    label: ["پیش‌بینی‌ها ثبت شد", "PICKS LOCKED IN"],
    title: ["تو آماده‌ای؛ حالا نوبت بازی است", "Your picks are in. Game on."],
    description: [
      "همه مسابقه‌های باز این برنامه را پیش‌بینی کرده‌ای. پیش‌بینی‌هایت را مرور کن و رقابت را دنبال کن.",
      "You’ve predicted every open fixture in this schedule. Review your picks and follow the competition.",
    ],
  },
  error: {
    icon: WifiOff,
    label: ["وقفه کوتاه", "A QUICK TIMEOUT"],
    title: ["مسابقه‌ها بارگیری نشدند", "We couldn’t load the fixtures."],
    description: [
      "دوباره تلاش کن تا مسابقه‌های در دسترس نمایش داده شوند.",
      "Try again to bring the available matches back into view.",
    ],
  },
} as const;

type Props = {
  variant: MatchEmptyVariant;
  compact?: boolean;
  onAction?: () => void;
  busy?: boolean;
};
export function MatchEmptyState({
  variant,
  compact = false,
  onAction,
  busy = false,
}: Props) {
  const { t, language } = useLanguage();
  const content = copy[variant];
  const Icon = content.icon;
  const action =
    variant === "error"
      ? t("تلاش دوباره", "Try again")
      : variant === "filtered"
        ? t("نمایش همه رقابت‌ها", "Show all competitions")
        : variant === "complete"
          ? t("مرور پیش‌بینی‌ها", "Review your picks")
          : variant === "upcoming"
            ? t("کشف رقابت‌ها", "Explore competitions")
            : t("پیش‌بینی مسابقه‌ها", "Make your next pick");
  const href =
    variant === "complete"
      ? "/matches?tab=open"
      : variant === "upcoming"
        ? "/leagues"
        : "/matches?tab=open";
  return (
    <div
      className={`${styles.state} ${compact ? styles.compact : ""}`}
      data-match-empty={variant}
      role="status"
    >
      <div className={styles.art} aria-hidden="true">
        <div className={styles.pitch}>
          <span className={styles.half} />
          <span className={styles.circle} />
          <span className={styles.goalLeft} />
          <span className={styles.goalRight} />
        </div>
        <div className={styles.ticket}>
          <span className={styles.crest} />
          <span className={styles.score}>
            {variant === "complete" ? (
              <CheckCheck size={25} />
            ) : (
              <>
                <i />
                <b>:</b>
                <i />
              </>
            )}
          </span>
          <span className={styles.crest} />
        </div>
        <span className={styles.badge}>
          <Icon size={19} strokeWidth={1.7} />
        </span>
      </div>
      <div className={styles.copy}>
        <span className={styles.label}>
          {t(content.label[0], content.label[1])}
        </span>
        <h3>{t(content.title[0], content.title[1])}</h3>
        <p>{t(content.description[0], content.description[1])}</p>
        <div className={styles.actions}>
          {onAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={busy}
              className={styles.primary}
            >
              {variant === "error" && (
                <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
              )}
              {busy ? t("در حال بارگیری…", "Loading…") : action}
            </button>
          ) : (
            <Link href={href} className={styles.primary}>
              {action}
              <ArrowRight
                size={15}
                className={language === "fa" ? "rotate-180" : ""}
              />
            </Link>
          )}
          {!compact && variant !== "complete" && variant !== "error" && (
            <Link href="/lowblock" className={styles.secondary}>
              {t("جدول امتیازات", "View standings")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
