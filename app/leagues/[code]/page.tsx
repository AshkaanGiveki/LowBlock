import { notFound } from "next/navigation";
import { getLeague } from "@/lib/football/leagues";
import { getDb } from "@/lib/db/mongo";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { currentUserId } from "@/lib/auth/session";
import { T } from "@/components/LanguageProvider";
import { LeagueRoundRail } from "@/components/LeagueRoundRail";
import { LeagueStandings } from "@/components/LeagueStandings";

export const dynamic = "force-dynamic";

export default async function LeaguePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const league = getLeague(code);
  if (!league) notFound();
  const db = await getDb();
  const year = Number((await db.collection("matches").findOne({ leagueCode: code }, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } }))?.seasonStartYear ?? new Date().getUTCFullYear());
  const rows = await getCanonicalLeaderboard(db, { leagueCode: code, seasonStartYear: year }, 100);
  const docs = await db.collection<any>("matches").find({ leagueCode: code, seasonStartYear: year, matchday: { $gt: 0 }, status: { $nin: ["VOID", "CANCELLED"] } }, { projection: { matchday: 1, status: 1, kickoffAt: 1 } }).toArray();
  const grouped = new Map<number, { number: number; count: number; active: boolean; completed: boolean }>();
  for (const match of docs) { const item = grouped.get(match.matchday) ?? { number: match.matchday, count: 0, active: false, completed: true }; item.count++; item.completed = item.completed && match.status === "FINISHED"; item.active = item.active || match.status === "LIVE" || (match.status === "SCHEDULED" && new Date(match.kickoffAt).getTime() > Date.now()); grouped.set(match.matchday, item); }
  const storedRounds = await db.collection<any>("rounds").find({ leagueCode: code, seasonId: String(year) }).sort({ number: 1 }).toArray();
  const rounds = (storedRounds.length ? storedRounds.map(round => ({ number: Number(round.number), count: Number(round.eligibleFixtures ?? grouped.get(Number(round.number))?.count ?? 0), active: round.status === "LIVE" || round.status === "UPCOMING", completed: round.status === "FINAL" })) : [...grouped.values()]).filter(round => round.count > 0).sort((a, b) => a.number - b.number);
  const activeNumber = rounds.find(round => round.active)?.number ?? rounds.find(round => !round.completed)?.number ?? rounds.at(-1)?.number;
  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-6xl"><section className="rounded-[2rem] border border-white/[.08] bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.24),transparent_38%),linear-gradient(145deg,#14251c,#0a0f0c)] p-6 md:p-9"><div className="flex items-center gap-4"><img src={league.logo} alt="" className="league-logo h-16 w-16 rounded-2xl object-contain"/><div><p className="text-xs font-black tracking-[.2em] text-brand"><T fa={`لیگ · ${year}`} en={`LEAGUE · ${year}`}/></p><h1 className="mt-1 text-3xl font-black"><T fa={league.faName} en={league.enName}/></h1></div></div></section><LeagueRoundRail code={code} rounds={rounds.map(round => ({ ...round, active: round.number === activeNumber }))}/><LeagueStandings rows={rows} me={await currentUserId()} leagueCode={code}/></div></main>;
}
