import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { currentUserId } from "@/lib/auth/session";
import { requireClubMember } from "@/lib/domain/clubs";
import { getLeague } from "@/lib/football/leagues";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { LeagueRoundRail } from "@/components/LeagueRoundRail";
import { ClubLeaderboard } from "@/components/ClubLeaderboard";
import { T } from "@/components/LanguageProvider";

export const dynamic = "force-dynamic";

export default async function ClubLeaguePage({ params }: { params: Promise<{ clubId: string; code: string }> }) {
  const { clubId, code } = await params;
  const league = getLeague(code);
  if (!league || !ObjectId.isValid(clubId)) notFound();
  const userId = await currentUserId();
  if (!userId) notFound();
  const db = await getDb();
  let club;
  try { ({ club } = await requireClubMember(db, clubId, userId)); } catch { notFound(); }
  const year = Number((await db.collection("matches").findOne({ leagueCode: code }, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } }))?.seasonStartYear ?? new Date().getUTCFullYear());
  const rows = await getCanonicalLeaderboard(db, { clubId, leagueCode: code, seasonStartYear: year }, 100);
  const rounds = await db.collection<any>("rounds").find({ leagueCode: code, seasonId: String(year) }).sort({ number: 1 }).toArray();
  const roundItems = rounds.map((round) => ({ number: Number(round.number), count: Number(round.eligibleFixtures ?? 0), active: round.status === "LIVE" || round.status === "UPCOMING", live: round.status === "LIVE", completed: round.status === "FINAL" }));
  const lastActive = roundItems.filter((round) => round.active).at(-1)?.number;
  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-5xl"><section className="relative overflow-hidden rounded-[2rem] border border-white/[.08] bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.22),transparent_38%),linear-gradient(145deg,#14251c,#0a0f0c)] p-7"><div className="flex items-center gap-4"><img src={league.logo} alt="" className="league-logo h-14 w-14 object-contain"/><div><p className="text-xs font-black tracking-[.2em] text-brand">{club.name}</p><h1 className="mt-2 text-3xl font-black"><T fa={league.faName} en={league.enName}/></h1><p className="mt-2 text-sm text-white/60"><T fa={`فصل ${year}/${String(year + 1).slice(-2)}`} en={`Season ${year}/${String(year + 1).slice(-2)}`}/></p></div></div></section><LeagueRoundRail code={code} basePath={`/club/${clubId}/league/${code}`} rounds={roundItems.map((round) => ({ ...round, active: round.number === lastActive }))}/><ClubLeaderboard rows={rows} titleFa="رقابت اعضای باشگاه" titleEn="Club league race" subtitleFa="امتیازهای اعضا در این لیگ، از همان جدول رسمی LowBlock محاسبه می‌شود." subtitleEn="Every member is ranked from the canonical LowBlock scorebook."/></div></main>;
}
