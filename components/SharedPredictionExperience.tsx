"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { TeamCrest } from "@/components/TeamCrest";
import { PredictionCard } from "@/components/PredictionCard";
import { GuestPredictionCard } from "@/components/GuestPredictionCard";
import { UserAvatar } from "@/components/UserAvatar";

type Match = {
  providerMatchId: string;
  kickoffAt: string;
  status: string;
  homeTeam: { id: number; name: string; logoUrl: string | null };
  awayTeam: { id: number; name: string; logoUrl: string | null };
};
type Prediction = { homeGoals: number; awayGoals: number };
type Winner = {
  name: string;
  avatarUrl: string | null;
  isDefendingChampion?: boolean;
  clubName: string | null;
  clubImageUrl: string | null;
  points: number;
};
type Props = {
  token: string;
  award: {
    competitionName: string;
    competitionId: string;
    seasonStartYear: number;
    roundNumber: number;
  };
  winner: Winner;
  match: Match | null;
  initial: Prediction | null;
  authenticated: boolean;
  imageUrl: string;
};

export function SharedPredictionExperience({
  token,
  award,
  winner,
  match,
  initial,
  authenticated,
  imageUrl,
}: Props) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial));
  const [localOnly, setLocalOnly] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(
    initial,
  );
  const [conversionOpen, setConversionOpen] = useState(false);
  return (
    <main className="shared-award-page min-h-screen px-4 pb-10 pt-20 text-white md:px-8 md:pt-24">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
        <AwardPanel
          imageUrl={imageUrl}
          award={award}
          winner={winner}
          t={t}
          language={language}
        />
        {match ? (
          <section className="flex w-full max-w-md flex-col items-center">
            {!open && (
              <MatchSummary
                match={match}
                t={t}
                onClick={() => setOpen(true)}
                language={language}
              />
            )}{" "}
            {open &&
              (authenticated ? (
                <PredictionCard
                  match={match}
                  initial={currentPrediction ?? undefined}
                  openOnMount
                  onPredictionSaved={(prediction) => {
                    setSaved(true);
                    setCurrentPrediction(prediction);
                    setOpen(false);
                  }}
                />
              ) : (
                <GuestPredictionCard
                  match={match}
                  initial={currentPrediction ?? undefined}
                  onClose={() => setOpen(false)}
                  onSaved={(only, prediction) => {
                    setSaved(true);
                    setLocalOnly(only);
                    setCurrentPrediction(prediction);
                    setOpen(false);
                    setConversionOpen(true);
                  }}
                />
              ))}
            {saved && authenticated && (
              <Link href="/predictions" className="sr-only">
                {t("تاریخچه من", "MY HISTORY")}
              </Link>
            )}
          </section>
        ) : null}
      </div>
      {!authenticated && (
        <ConversionModal
          open={conversionOpen}
          token={token}
          localOnly={localOnly}
          t={t}
          onClose={() => setConversionOpen(false)}
        />
      )}
    </main>
  );
}

function MatchSummary({
  match,
  t,
  onClick,
  language,
}: {
  match: Match;
  t: (fa: string, en: string) => string;
  onClick: () => void;
  language: "fa" | "en";
}) {
  const reduced = useReducedMotion();
  const [showMotivation, setShowMotivation] = useState(false);
  const [motivationIndex, setMotivationIndex] = useState(0);
  const lines =
    language === "fa"
      ? ["ثابت کن تو قویتری", "تاج بعدی برای توئه"]
      : ["Prove that CROWN is yours.", "Take the next crown."];
  const line = lines[motivationIndex];
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(
      () =>
        setShowMotivation((value) => {
          if (value) setMotivationIndex((index) => (index + 1) % lines.length);
          return !value;
        }),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [reduced, lines.length]);
  useEffect(() => {
    if (!showMotivation) {
      setTyped("");
      return;
    }
    if (reduced) {
      setTyped(line);
      return;
    }
    setTyped("");
    let index = 0;
    const units = language === "fa" ? line.split(/(\s+)/) : Array.from(line);
    const timer = window.setInterval(
      () => {
        index += 1;
        setTyped(units.slice(0, index).join(""));
        if (index >= units.length) window.clearInterval(timer);
      },
      language === "fa" ? 260 : 58,
    );
    return () => window.clearInterval(timer);
  }, [line, language, reduced, showMotivation]);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={t("باز کردن پیش‌بینی مسابقه", "Open match prediction")}
      className="group relative isolate flex h-[78px] w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-brand/50 bg-[#09140f] px-4 py-2 text-start shadow-[0_18px_55px_rgba(0,0,0,.32),inset_0_1px_0_rgba(255,255,255,.08)]"
      style={{
        backgroundImage:
          "linear-gradient(110deg,rgba(32,184,121,.18),rgba(8,14,10,.92),rgba(232,198,106,.16),rgba(32,184,121,.18))",
        backgroundSize: "240% 100%",
      }}
      animate={
        reduced
          ? undefined
          : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }
      }
      transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      whileTap={reduced ? undefined : { scale: 0.985 }}
    >
      <span className="pointer-events-none absolute inset-px -z-10 rounded-[.9rem] border border-white/[.04]" />
      <span className="pointer-events-none absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(32,184,121,.18),transparent_55%)]" />
      <AnimatePresence mode="wait" initial={false}>
        {showMotivation ? (
          <motion.span
            key={`motivation-${motivationIndex}`}
            initial={
              reduced ? undefined : { opacity: 0, y: 10, filter: "blur(5px)" }
            }
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={
              reduced ? undefined : { opacity: 0, y: -10, filter: "blur(5px)" }
            }
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="px-2 text-center text-lg font-black tracking-wide text-white/90 md:text-xl"
          >
            {typed}
            {!reduced && <span className="ms-1 text-brand">▌</span>}
          </motion.span>
        ) : (
          <motion.span
            key="match"
            initial={
              reduced ? undefined : { opacity: 0, y: -10, filter: "blur(5px)" }
            }
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={
              reduced ? undefined : { opacity: 0, y: 10, filter: "blur(5px)" }
            }
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3"
          >
            <span className="flex justify-center transition-transform duration-200 group-hover:scale-105">
              <TeamCrest
                name={match.homeTeam.name}
                logo={match.homeTeam.logoUrl}
                className="h-10 w-10"
              />
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[#e8c66a]/55 bg-[#e8c66a]/10 text-[9px] font-black tracking-widest text-[#e8c66a]">
              VS
            </span>
            <span className="flex justify-center transition-transform duration-200 group-hover:scale-105">
              <TeamCrest
                name={match.awayTeam.name}
                logo={match.awayTeam.logoUrl}
                className="h-10 w-10"
              />
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function AwardPanel({
  imageUrl,
  award,
  winner,
  t,
  language,
}: {
  imageUrl: string;
  award: Props["award"];
  winner: Winner;
  t: (fa: string, en: string) => string;
  language: "fa" | "en";
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center">
      <img
        src={imageUrl}
        alt={`${award.competitionName} Round Winner`}
        className="block w-full drop-shadow-[0_24px_70px_rgba(0,0,0,.5)]"
      />
      <div className="relative mt-3 w-full overflow-hidden rounded-2xl border border-[#e8c66a]/30 bg-[linear-gradient(120deg,rgba(232,198,106,.12),rgba(32,184,121,.08)_45%,rgba(0,0,0,.22))] p-3">
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(135deg,transparent_0%,rgba(255,255,255,.2)_45%,transparent_46%),linear-gradient(45deg,transparent_0%,rgba(32,184,121,.18)_50%,transparent_51%)]" />
        <div className="relative flex items-center gap-3">
          <UserAvatar name={winner.name} avatarUrl={winner.avatarUrl} isDefendingChampion={winner.isDefendingChampion} className="h-11 w-11 rounded-xl border border-[#e8c66a]/45 bg-[#e8c66a]/15 text-sm text-[#f4d982]" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black tracking-[.16em] text-[#e8c66a]">
              {t("قهرمان این کارت", "CARD WINNER")}
            </p>
            <p className="truncate text-sm font-black text-white">
              {winner.name}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-white/55">
              {winner.clubImageUrl ? (
                <img
                  src={winner.clubImageUrl}
                  alt={winner.clubName ?? "Club"}
                  className="h-4 w-4 rounded-full object-cover"
                />
              ) : winner.clubName ? (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-brand/20 text-[7px] font-black text-brand">
                  {winner.clubName.slice(0, 2).toUpperCase()}
                </span>
              ) : (
                <LockKeyhole size={11} />
              )}
              <span className="truncate">
                {winner.clubName ?? t("بدون باشگاه", "No club")}
              </span>
            </div>
          </div>
          <div className="shrink-0 border-s border-white/10 ps-3 text-end">
            <p className="text-[9px] font-black tracking-[.13em] text-white/45">
              {t("امتیاز راند", "ROUND POINTS")}
            </p>
            <p className="text-xl font-black text-[#e8c66a]">
              {new Intl.NumberFormat(
                language === "fa" ? "fa-IR" : "en-US",
              ).format(winner.points)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversionModal({
  open,
  token,
  localOnly,
  t,
  onClose,
}: {
  open: boolean;
  token: string;
  localOnly: boolean;
  t: (fa: string, en: string) => string;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-5 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-conversion-title"
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-brand/35 bg-[radial-gradient(circle_at_100%_0%,rgba(32,184,121,.24),transparent_45%),linear-gradient(145deg,#14251c,#080e0a)] p-6 text-center shadow-[0_28px_100px_rgba(0,0,0,.65)]"
          >
            <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-[#e8c66a]/10 blur-3xl" />
            <div className="relative">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-brand/35 bg-brand/15 text-brand">
                <Check size={22} />
              </span>
              <p className="mt-5 text-[10px] font-black tracking-[.2em] text-brand">
                {localOnly
                  ? t("روی این دستگاه ذخیره شد", "SAVED ON THIS DEVICE")
                  : t("پیش‌بینی ذخیره شد", "PREDICTION SAVED")}
              </p>
              <h2
                id="shared-conversion-title"
                className="mt-2 text-2xl font-black text-white"
              >
                {t("به بازی ملحق شو", "JOIN THE GAME")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/65">
                {t(
                  "پیش‌بینی‌ات را برای همیشه نگه دار و برای تاج بعدی رقابت کن.",
                  "Keep your prediction forever and compete for the next crown.",
                )}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] font-black text-white/65">
                <span className="rounded-xl border border-brand/20 bg-brand/10 px-2 py-3">
                  {t("امتیاز", "POINTS")}
                </span>
                <span className="rounded-xl border border-[#e8c66a]/20 bg-[#e8c66a]/10 px-2 py-3">
                  {t("تاج‌ها", "TROPHIES")}
                </span>
                <span className="rounded-xl border border-white/10 bg-white/[.04] px-2 py-3">
                  {t("تاریخچه", "HISTORY")}
                </span>
              </div>
              <Link
                href={`/signup?returnTo=${encodeURIComponent(`/s/${token}`)}`}
                onClick={onClose}
                className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-brand text-sm font-black text-[#06120c]"
              >
                {t("ساخت پروفایل", "CREATE PROFILE")}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-white/[.04] text-sm font-black text-white/70 transition hover:border-white/25 hover:text-white"
              >
                {t("شاید بعداً", "MAYBE LATER")}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
