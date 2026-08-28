import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import {
  BarChart3,
  Crown,
  Medal,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { getDb } from "@/lib/db/mongo";
import { getDefendingChampionUserId } from "@/lib/awards/defendingChampion";
import { UserAvatar } from "@/components/UserAvatar";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { T } from "@/components/LanguageProvider";
import { BackButton } from "@/components/BackButton";
import { PublicPredictionHistory } from "./PublicPredictionHistory";
import { PublicAwardsSection } from "@/components/PublicAwardsSection";

export const dynamic = "force-dynamic";

export default async function PublicProfile({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const db = await getDb();
  const [user, championId] = await Promise.all([
    db.collection<any>("users").findOne(
      { normalizedUsername: username.toLowerCase() },
      { projection: { username: 1, avatarUrl: 1, bio: 1 } },
    ),
    getDefendingChampionUserId(db),
  ]);
  if (!user) notFound();
  const userId = String(user._id);
  const year = Number(
    (
      await db
        .collection("matches")
        .findOne(
          {},
          { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } },
        )
    )?.seasonStartYear ?? new Date().getUTCFullYear(),
  );
  const global = await getCanonicalLeaderboard(
    db,
    { seasonStartYear: year },
    1000,
  );
  const row = global.find((item) => item.userId === userId);
  const totalPredictions = await db
    .collection("predictions")
    .countDocuments({ userId });
  const scoredMatches = await db
    .collection("predictionScores")
    .countDocuments({ userId });
  const exact = await db
    .collection("predictionScores")
    .countDocuments({ userId, exactScore: true });
  const roundWins = await db
    .collection("roundWinners")
    .countDocuments({ userId });
  const membership = await db
    .collection<any>("clubMemberships")
    .findOne({ userId, leftAt: null });
  const club =
    membership && ObjectId.isValid(membership.clubId)
      ? await db
          .collection<any>("clubs")
          .findOne(
            { _id: new ObjectId(membership.clubId) },
            { projection: { name: 1, imageUrl: 1, visibility: 1, state: 1 } },
          )
      : null;
  const metrics = [
    {
      value: row?.rank ?? "—",
      fa: "رتبه فصل",
      en: "Season rank",
      icon: <Medal size={17} />,
    },
    {
      value: row?.points ?? 0,
      fa: "امتیاز فصل",
      en: "Season points",
      icon: <Sparkles size={17} />,
    },
    {
      value: totalPredictions,
      fa: "پیش‌بینی‌ها",
      en: "Predictions",
      icon: <BarChart3 size={17} />,
    },
    {
      value: exact,
      fa: "پیش‌بینی دقیق",
      en: "Exact picks",
      icon: <Trophy size={17} />,
    },
  ];
  return (
    <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-4xl">
        <section className="relative isolate overflow-hidden rounded-[2.25rem] border border-brand/25 bg-[radial-gradient(circle_at_50%_-15%,rgba(32,184,121,.34),transparent_42%),linear-gradient(150deg,#142b20,#080e0a)] p-6 shadow-[0_28px_100px_rgba(0,0,0,.3)] sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 -z-10 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-14 -z-10 h-60 w-60 rounded-full bg-[#e8c66a]/10 blur-3xl" />
          <div className="relative mx-auto grid w-fit place-items-center">
            <span className="absolute -inset-4 rounded-full border border-dashed border-brand/35" />
            <span className="absolute -inset-8 rounded-full border border-brand/10" />
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-2 border-brand/70 bg-brand/15 text-3xl font-black text-white shadow-[0_0_0_8px_rgba(32,184,121,.1),0_18px_50px_rgba(0,0,0,.3)] sm:h-32 sm:w-32">
              <UserAvatar name={user.username} avatarUrl={user.avatarUrl} isDefendingChampion={String(user._id) === championId} className="h-full w-full text-3xl" />
            </div>
            <span className="absolute -bottom-2 grid h-8 w-8 place-items-center rounded-full border-2 border-[#0d1711] bg-brand text-[#07100b]">
              <Crown size={15} />
            </span>
          </div>
          <div className="relative mt-7 text-center">
            <p className="text-[10px] font-black tracking-[.24em] text-brand">
              <T fa="پروفایل بازیکن" en="PLAYER PROFILE" />
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
              {user.username}
            </h1>
            <p className="mt-2 text-sm text-white/50">@{user.username}</p>
            {user.bio && (
              <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/70">
                {user.bio}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-[10px] font-black text-brand">
                <Zap size={13} />
                <T fa="رقابت جهانی فعال" en="Global competition active" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[10px] font-bold text-white/55">
                <Users size={13} />
                {year}/{String(year + 1).slice(-2)}
              </span>
            </div>
          </div>
        </section>
        <PublicAwardsSection username={user.username} />
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.en}
              className="metric-tile group relative overflow-hidden rounded-[1.35rem] border border-white/[.1] bg-[linear-gradient(145deg,rgba(25,52,38,.82),rgba(10,17,13,.9))] p-4 shadow-[0_14px_40px_rgba(0,0,0,.18)] transition duration-300 hover:-translate-y-1 hover:border-brand/45"
            >
              <span className="metric-tile-glow" />
              <div className="relative">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
                  {metric.icon}
                </span>
              </div>
              <b className="relative mt-4 block text-2xl font-black tracking-tight text-white">
                {metric.value}
              </b>
              <small className="relative mt-1 block truncate text-[10px] font-black tracking-wide text-white/50">
                <T fa={metric.fa} en={metric.en} />
              </small>
              <span className="relative mt-4 block h-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full w-2/3 rounded-full bg-gradient-to-r from-brand/30 to-brand" />
              </span>
            </div>
          ))}
        </section>
        {club && club.visibility !== "PRIVATE" && (
          <section className="relative mt-4 overflow-hidden rounded-[1.75rem] border border-[#e8c66a]/25 bg-[radial-gradient(circle_at_88%_0%,rgba(232,198,106,.16),transparent_38%),linear-gradient(145deg,#18271d,#0b120e)] p-5 shadow-[0_18px_60px_rgba(0,0,0,.2)] sm:p-6">
            <div className="absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-brand/10 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#e8c66a]/60 bg-brand/15 p-1 shadow-[0_0_0_5px_rgba(232,198,106,.08)]">
                {club.imageUrl ? (
                  <img
                    src={club.imageUrl}
                    alt={club.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-black text-brand">
                    {club.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black tracking-[.2em] text-[#e8c66a]">
                  <T fa="باشگاه فعلی" en="CURRENT CLUB" />
                </p>
                <h2 className="mt-1 truncate text-xl font-black text-white sm:text-2xl">
                  {club.name}
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  {club.state === "ACTIVE" ? (
                    <T fa="باشگاه فعال" en="Active Club" />
                  ) : (
                    <T fa="باشگاه در حال شکل‌گیری" en="Forming Club" />
                  )}
                </p>
              </div>
              <ShieldIcon />
            </div>
          </section>
        )}
        <section className="mt-4 grid grid-cols-2 gap-3">
          <ProfileStat
            icon={<Crown size={16} />}
            value={roundWins}
            fa="برد دورها"
            en="Round wins"
          />
          <ProfileStat
            icon={<BarChart3 size={16} />}
            value={scoredMatches}
            fa="بازی‌های امتیازدار"
            en="Scored matches"
          />
        </section>
        <BackButton />
        <PublicPredictionHistory username={user.username} />
      </div>
    </main>
  );
}

function ProfileStat({
  icon,
  value,
  fa,
  en,
}: {
  icon: React.ReactNode;
  value: number;
  fa: string;
  en: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/[.08] bg-[#101812] p-4 shadow-[0_12px_35px_rgba(0,0,0,.14)]">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </span>
      <b className="mt-3 block text-2xl font-black text-white">{value}</b>
      <small className="mt-1 block text-[10px] text-white/45">
        <T fa={fa} en={en} />
      </small>
    </div>
  );
}
function ShieldIcon() {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#e8c66a]/25 bg-[#e8c66a]/10 text-[#e8c66a]">
      <Trophy size={18} />
    </span>
  );
}
