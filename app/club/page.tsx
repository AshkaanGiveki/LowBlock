"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Crown,
  Gauge,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  OwnerRequestsBanner,
  PendingSwitchBanner,
} from "@/components/ClubRequestBanners";
import { LeaderboardFilters } from "@/components/LeaderboardFilters";
import type { LeaderboardSelection } from "@/components/LeaderboardFilters";
import { UserAvatar } from "@/components/UserAvatar";

type Club = {
  _id: string;
  name: string;
  imageUrl: string | null;
  state: "FORMING" | "ACTIVE";
  discoveryMode: string;
  activatedAt: string | null;
};
type Performance = {
  rank: number | null;
  points: number;
  exact: number;
  roundWins: number;
  predictions?: number;
};
type LeaderboardRow = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isDefendingChampion?: boolean;
  points: number;
  exact: number;
  predictions: number;
  rank: number;
};
type PendingJoinRequest = {
  id: string;
  clubId: string;
  club: { name: string; imageUrl: string | null; state: string };
  createdAt: string;
};

export default function ClubPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState(0);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardScope, setLeaderboardScope] = useState<
    "season" | "weekly" | "lifetime"
  >("season");
  const [leaderboardWeekOffset, setLeaderboardWeekOffset] = useState(0);
  const [pendingJoinRequest, setPendingJoinRequest] =
    useState<PendingJoinRequest | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const scopeParam = searchParams.get("scope");
  const requestedScope: "season" | "weekly" | "lifetime" =
    scopeParam === "weekly" || scopeParam === "lifetime"
      ? scopeParam
      : "season";
  const requestedWeek =
    searchParams.get("week") === "previous" ? "&week=previous" : "";
  useEffect(() => {
    setLeaderboardScope(requestedScope);
    setLeaderboardWeekOffset(requestedWeek ? 1 : 0);
    setLoading(true);
    fetch(`/api/clubs?scope=${requestedScope}${requestedWeek}`)
      .then((response) => response.json())
      .then((data) => {
        setClub(data.club);
        setMembers(data.members ?? 0);
        setPerformance(data.performance ?? null);
        setLeaderboard(data.leaderboard ?? []);
        setPendingJoinRequest(data.pendingJoinRequest ?? null);
        setPendingCount(data.pendingCount ?? 0);
        setIsOwner(data.membership?.role === "OWNER");
      })
      .finally(() => setLoading(false));
  }, [requestedScope, requestedWeek]);

  async function changeLeaderboard(selection: LeaderboardSelection) {
    setLeaderboardScope(
      selection.weekly ? "weekly" : selection.lifetime ? "lifetime" : "season",
    );
    setLeaderboardWeekOffset(selection.weekOffset);
    try {
      const query = new URLSearchParams({
        scope: selection.weekly
          ? "weekly"
          : selection.lifetime
            ? "lifetime"
            : "season",
      });
      if (selection.weekly && selection.weekOffset)
        query.set("week", "previous");
      const response = await fetch(`/api/clubs?${query}`);
      if (!response.ok) throw new Error("club leaderboard request failed");
      const data = await response.json();
      setLeaderboard(data.leaderboard ?? []);
    } catch {
      setLeaderboard([]);
    }
  }
  if (loading) return <ClubSkeleton />;
  if (!club && pendingJoinRequest)
    return <PendingClub request={pendingJoinRequest} t={t} />;
  if (!club) return <EmptyClub t={t} />;
  const progress = Math.min(100, Math.round((members / 3) * 100));

  return (
    <main className="min-h-screen px-4 pb-28 pt-20 md:px-8 md:pt-28">
      <div className="mx-auto max-w-5xl">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1610] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-8 md:p-10"
        >
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,rgba(32,184,121,.28),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(117,225,171,.14),transparent_32%),linear-gradient(135deg,#142a1e,#07100b_72%)]" />
          <div className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
          <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <ClubAvatar club={club} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[10px] font-black tracking-[.14em] text-brand">
                    <ShieldCheck size={13} />
                    {club.state === "ACTIVE"
                      ? t("فعال", "ACTIVE")
                      : t("در حال شکل‌گیری", "FORMING")}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">
                    {t("هویت باشگاه", "CLUB IDENTITY")}
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                  {club.name}
                </h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-white/55">
                  <Users size={15} className="text-brand" />
                  {members}{" "}
                  {t(
                    "عضو · یک تیم، همه لیگ‌ها",
                    "members · one team, every league",
                  )}
                </p>
              </div>
            </div>
            <Link
              href={`/club/${club._id}/settings`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.05] px-4 py-3 text-sm font-black transition hover:border-brand/50 hover:bg-brand/10"
            >
              <Settings2 size={17} />
              {t("مدیریت", "Manage")}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </motion.section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroMetric
            icon={<Trophy size={17} />}
            label={t("رتبه فصلی", "Season rank")}
            value={performance?.rank ? `#${performance.rank}` : "—"}
          />
          <HeroMetric
            icon={<Sparkles size={17} />}
            label={t("امتیاز در باشگاه", "Club points")}
            value={String(performance?.points ?? 0)}
          />
          <HeroMetric
            icon={<Zap size={17} />}
            label={t("پیش‌بینی‌های دقیق", "Exact predictions")}
            value={String(performance?.exact ?? 0)}
          />
          <HeroMetric
            icon={<Crown size={17} />}
            label={t("راندهای برنده‌شده", "Round wins")}
            value={String(performance?.roundWins ?? 0)}
          />
        </section>

        <nav className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#101812] p-2 shadow-lg">
          <NavItem
            href="/club"
            active
            icon={<Gauge size={16} />}
            label={t("نمای کلی", "Overview")}
          />
          <NavItem
            href={`/club/${club._id}/match-centre`}
            icon={<BarChart3 size={16} />}
            label={t("مرکز مسابقات", "Match Centre")}
          />
          <NavItem
            href={`/club/${club._id}/members`}
            icon={<Users size={16} />}
            label={t("اعضای باشگاه", "Members")}
          />
        </nav>

        <LeaderboardFilters
          lifetime={leaderboardScope === "lifetime"}
          weekly={leaderboardScope === "weekly"}
          weekOffset={leaderboardWeekOffset}
          basePath="/club"
          showLeagues={false}
          onNavigate={changeLeaderboard}
        />
        <ClubLeaderboard rows={leaderboard} t={t} clubId={club._id} />

        {isOwner && (
          <OwnerRequestsBanner clubId={club._id} count={pendingCount} t={t} />
        )}
        {pendingJoinRequest && (
          <PendingSwitchBanner request={pendingJoinRequest} t={t} />
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.08 } }}
            className="rounded-[1.75rem] border border-white/10 bg-[#101812] p-5 sm:p-7"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-brand">
                  <Sparkles size={17} />
                  <span className="text-[10px] font-black tracking-[.18em]">
                    YOUR SEASON
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  {t("فرم فعلی شما", "Your season form")}
                </h2>
              </div>
              <span className="rounded-xl bg-brand/10 px-3 py-2 text-xs font-black text-brand">
                {performance?.predictions ?? 0} {t("پیش‌بینی", "picks")}
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                icon={<Trophy size={15} />}
                label={t("رتبه فصلی", "Season rank")}
                value={performance?.rank ? `#${performance.rank}` : "—"}
              />
              <Stat
                icon={<Sparkles size={15} />}
                label={t("امتیاز در باشگاه", "Club points")}
                value={String(performance?.points ?? 0)}
              />
              <Stat
                icon={<Zap size={15} />}
                label={t("پیش‌بینی‌های دقیق", "Exact predictions")}
                value={String(performance?.exact ?? 0)}
              />
              <Stat
                icon={<Crown size={15} />}
                label={t("راندهای برنده‌شده", "Round wins")}
                value={String(performance?.roundWins ?? 0)}
              />
            </div>
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/[.06] bg-black/20 p-4">
              <div>
                <p className="text-xs font-black">
                  {t(
                    "رقابت را عمیق‌تر دنبال کنید",
                    "Go deeper into the competition",
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t(
                    "دور، لیگ و عملکرد اعضا را ببینید.",
                    "Explore rounds, leagues and your members.",
                  )}
                </p>
              </div>
              <Link
                href={`/club/${club._id}/match-centre`}
                className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-[#07100b] transition hover:scale-105"
              >
                <ChevronRight size={19} />
              </Link>
            </div>
          </motion.section>
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.14 } }}
            className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(150deg,#193323,#0b140e)] p-5 sm:p-7"
          >
            <div className="absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-brand/15 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eacb70]/15 text-[#eacb70]">
                  <Crown size={21} />
                </div>
                <span className="text-xs font-black text-white/50">
                  {club.state === "ACTIVE" ? "100%" : `${progress}%`}
                </span>
              </div>
              <h2 className="mt-6 text-2xl font-black">
                {club.state === "ACTIVE"
                  ? t("باشگاه در حال رقابت است", "Your Club is competing")
                  : t("آخرین قدم تا شروع", "One step from launch")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/55">
                {club.state === "ACTIVE"
                  ? t(
                      "تمام لیگ‌های پشتیبانی‌شده همین حالا برای شما فعال‌اند.",
                      "Every supported league is live for your Club.",
                    )
                  : t(
                      `برای فعال‌شدن، ${Math.max(0, 3 - members)} عضو دیگر اضافه کنید.`,
                      `Add ${Math.max(0, 3 - members)} more member(s) to activate.`,
                    )}
              </p>
              {club.state !== "ACTIVE" && (
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-black/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-brand shadow-[0_0_18px_rgba(32,184,121,.7)]"
                  />
                </div>
              )}
              <Link
                href={`/club/${club._id}/members`}
                className="mt-6 inline-flex items-center gap-2 text-sm font-black text-brand"
              >
                {t("مشاهده تیم", "View the team")}
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </motion.section>
        </div>
        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <QuickAction
            href={`/club/${club._id}/match-centre`}
            icon={<CalendarDays />}
            title={t("مرکز مسابقات", "Match Centre")}
            text={t("لیگ‌ها و دورها", "Leagues and rounds")}
          />
          <QuickAction
            href={`/club/${club._id}/members`}
            icon={<Users />}
            title={t("تیم ما", "Our team")}
            text={`${members} ${t("عضو فعال", "active members")}`}
          />
          <QuickAction
            href={`/club/${club._id}/settings`}
            icon={<Settings2 />}
            title={t("هویت باشگاه", "Club identity")}
            text={t("تصویر و مدیریت", "Image and admin")}
          />
        </section>
      </div>
    </main>
  );
}

function ClubAvatar({
  club,
  size = "sm",
}: {
  club: Pick<Club, "name" | "imageUrl">;
  size?: "sm" | "lg";
}) {
  const dimensions = size === "lg" ? "h-24 w-24 sm:h-28 sm:w-28" : "h-12 w-12";
  return (
    <div
      className={`${dimensions} relative shrink-0 rounded-full border-2 border-brand/60 bg-[#102119] p-1 shadow-[0_0_0_6px_rgba(32,184,121,.08),0_12px_36px_rgba(0,0,0,.3)]`}
    >
      <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_20%,#2c9d6d,#102119_72%)] text-xl font-black text-white">
        {club.imageUrl ? (
          <img
            src={club.imageUrl}
            alt={club.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{club.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <span className="absolute bottom-1 right-0 grid h-5 w-5 place-items-center rounded-full border-2 border-[#0c1610] bg-brand text-[#07100b]">
        <ShieldCheck size={11} />
      </span>
    </div>
  );
}
function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="metric-tile group relative overflow-hidden rounded-[1.35rem] border border-white/[.1] bg-[linear-gradient(145deg,rgba(25,52,38,.82),rgba(10,17,13,.9))] p-4 shadow-[0_14px_40px_rgba(0,0,0,.18)] transition duration-300 hover:-translate-y-1 hover:border-brand/45">
      <span className="metric-tile-glow" />
      <div className="relative flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand transition group-hover:scale-110">
          {icon}
        </span>
        <span className="text-[9px] font-black tracking-[.16em] text-white/25">
          LOWBLOCK
        </span>
      </div>
      <b className="relative mt-4 block text-2xl font-black tracking-tight text-white">
        {value}
      </b>
      <small className="relative mt-1 block truncate text-[10px] font-black tracking-wide text-white/50">
        {label}
      </small>
      <span className="relative mt-4 block h-1 overflow-hidden rounded-full bg-white/10">
        <span className="block h-full w-2/3 rounded-full bg-gradient-to-r from-brand/30 to-brand" />
      </span>
    </div>
  );
}
function ClubLeaderboard({
  rows,
  t,
  clubId,
}: {
  rows: LeaderboardRow[];
  t: (fa: string, en: string) => string;
  clubId: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }}
      className="mt-4 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101812] shadow-[0_18px_60px_rgba(0,0,0,.16)]"
    >
      <div className="relative overflow-hidden border-b border-white/[.07] bg-[radial-gradient(circle_at_88%_0%,rgba(32,184,121,.22),transparent_38%),linear-gradient(135deg,#172b20,#0c130e)] p-5 sm:p-7">
        <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand">
              <Crown size={17} />
              <span className="text-[10px] font-black tracking-[.18em]">
                {t("جدول امتیازات باشگاه", "CLUB LEADERBOARD")}
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              {t("رقابت داخلی باشگاه", "The Club race")}
            </h2>
            <p className="mt-2 text-xs leading-6 text-white/50">
              {t(
                "امتیازهای فصل اعضا بر اساس جدول رسمی و مشترک LowBlock.",
                "Every member’s season points, ranked from the canonical LowBlock scorebook.",
              )}
            </p>
          </div>
          <Link
            href={`/club/${clubId}/standings`}
            className="inline-flex items-center gap-1 text-xs font-black text-brand"
          >
            {t("جدول کامل", "Full table")}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        {rows.length ? (
          <div className="space-y-2">
            {rows.map((row, index) => (
              <Link
                href={`/u/${encodeURIComponent(row.username)}`}
                key={row.userId}
                className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition hover:-translate-y-0.5 ${index === 0 ? "border-[#eacb70]/30 bg-[#eacb70]/[.08]" : "border-white/[.06] bg-black/15 hover:border-brand/30 hover:bg-brand/[.05]"}`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${index === 0 ? "bg-[#eacb70] text-[#241d08]" : "bg-white/[.06] text-white/55"}`}
                >
                  {index < 3 ? <Crown size={14} /> : row.rank}
                </span>
                <UserAvatar name={row.username} avatarUrl={row.avatarUrl} isDefendingChampion={row.isDefendingChampion} className="h-10 w-10 text-xs" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{row.username}</b>
                  <small className="text-[10px] text-[var(--muted)]">
                    {row.exact} {t("پیش‌بینی دقیق", "exact picks")} ·{" "}
                    {row.predictions} {t("پیش‌بینی", "picks")}
                  </small>
                </span>
                <span className="text-end">
                  <b className="block text-lg font-black text-brand">
                    {row.points}
                  </b>
                  <small className="text-[10px] text-white/35">PTS</small>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-[var(--muted)]">
            {t(
              "هنوز امتیازی برای نمایش وجود ندارد.",
              "No scored Club results yet.",
            )}
          </div>
        )}
        <Link
          href={`/club/${clubId}/members`}
          className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/[.07] py-3 text-xs font-black text-brand transition hover:bg-brand/10 sm:hidden"
        >
          {t("مشاهده جدول کامل", "View full leaderboard")}
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </motion.section>
  );
}
function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <span className="text-brand">{icon}</span>
      <b className="mt-1 block text-xl font-black">{value}</b>
      <small className="text-[10px] text-[var(--muted)]">{label}</small>
    </div>
  );
}
function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-black transition ${active ? "bg-brand/15 text-brand shadow-inner" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
function QuickAction({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101812] p-4 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/[.06]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:scale-105">
        {icon}
      </span>
      <span className="min-w-0">
        <b className="block text-sm">{title}</b>
        <small className="text-xs text-[var(--muted)]">{text}</small>
      </span>
      <ArrowUpRight
        className="ms-auto text-white/25 transition group-hover:text-brand"
        size={16}
      />
    </Link>
  );
}
function PendingClub({
  request,
  t,
}: {
  request: PendingJoinRequest;
  t: (fa: string, en: string) => string;
}) {
  return (
    <main className="min-h-screen px-4 pb-28 pt-20 md:px-8 md:pt-28">
      <div className="mx-auto max-w-3xl">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-brand/25 bg-[radial-gradient(circle_at_85%_0%,rgba(32,184,121,.28),transparent_38%),linear-gradient(145deg,#142a1e,#07100b)] p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,.28)] sm:p-12"
        >
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/15 blur-3xl" />
          <div className="relative">
            <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-brand/60 bg-brand/10 p-1 shadow-[0_0_0_8px_rgba(32,184,121,.08)]">
              {request.club.imageUrl ? (
                <img
                  src={request.club.imageUrl}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <Users className="text-brand" size={30} />
              )}
            </div>
            <span className="mt-7 inline-flex items-center gap-2 rounded-full border border-[#eacb70]/30 bg-[#eacb70]/10 px-3 py-1.5 text-[10px] font-black tracking-[.14em] text-[#eacb70]">
              <Sparkles size={13} />
              {t("در انتظار بررسی", "AWAITING REVIEW")}
            </span>
            <h1 className="mt-4 text-3xl font-black sm:text-5xl">
              {t("درخواست عضویت شما ارسال شد", "Your join request is pending")}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/55">
              {t(
                `درخواست شما برای عضویت در ${request.club.name} نزد مدیر باشگاه است. تا زمان پاسخ، امکان ارسال درخواست دیگر یا ساخت باشگاه جدید ندارید.`,
                `Your request to join ${request.club.name} is waiting for the Club owner. Until it is resolved, you cannot send another request or create a new Club.`,
              )}
            </p>
            <div className="mx-auto mt-8 flex max-w-md items-center gap-3 rounded-2xl border border-brand/20 bg-black/20 p-4 text-start">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                <ClockIcon />
              </span>
              <span>
                <b className="block text-sm">{request.club.name}</b>
                <small className="text-xs text-[var(--muted)]">
                  {t("درخواست در حال بررسی است", "Request is being reviewed")}
                </small>
              </span>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
function ClockIcon() {
  return <span className="text-lg">⏳</span>;
}
function ClubSkeleton() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-20 md:px-8 md:pt-28">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-72 rounded-[2rem] bg-white/[.06]" />
        <div className="mt-4 h-16 rounded-2xl bg-white/[.04]" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="h-72 rounded-[1.75rem] bg-white/[.04]" />
          <div className="h-72 rounded-[1.75rem] bg-white/[.04]" />
        </div>
      </div>
    </main>
  );
}
function EmptyClub({ t }: { t: (fa: string, en: string) => string }) {
  return (
    <main className="min-h-screen px-4 pb-28 pt-20 md:px-8 md:pt-28">
      <motion.section
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(32,184,121,.25),transparent_35%),linear-gradient(145deg,#142a1e,#07100b)] p-8 sm:p-12"
      >
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/15 text-brand">
          <Users size={28} />
        </div>
        <p className="mt-8 text-xs font-black tracking-[.2em] text-brand">
          YOUR CLUB
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight sm:text-6xl">
          {t("باشگاه خودت را بساز.", "Build the team you represent.")}
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-8 text-[var(--muted)]">
          {t(
            "عضویت اختیاری است؛ رقابت جهانی شما همین حالا فعال است.",
            "Club membership is optional. Your global LowBlock competition is already active.",
          )}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/club/create"
            className="rounded-2xl bg-brand px-5 py-3.5 text-sm font-black text-[#07100b]"
          >
            {t("ساخت باشگاه", "Create Club")}
          </Link>
          <Link
            href="/club/discover"
            className="rounded-2xl border border-white/10 px-5 py-3.5 text-sm font-black"
          >
            {t("پیدا کردن باشگاه", "Find a Club")}
          </Link>
        </div>
      </motion.section>
    </main>
  );
}
