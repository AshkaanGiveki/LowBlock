import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getLeaderboardSummary, getCachedCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { getLatestSeasonStartYear, getMatchesPage, getPredictions } from "@/lib/football/data";
import { getViewerH2HTodayMatch } from "@/lib/domain/h2h";

export const dynamic = "force-dynamic";

export async function GET() {
  const [page, userId] = await Promise.all([getMatchesPage(50), currentUserId()]);
  const eligibleMatches = page.matches.filter((match: any) => match.status === "SCHEDULED" && new Date(match.kickoffAt).getTime() > Date.now());
  const predictions = await getPredictions(eligibleMatches.map((match: any) => match.providerMatchId), userId ?? "guest");
  const matches = eligibleMatches.filter((match: any) => !predictions.has(match.providerMatchId)).slice(0, 5);
  const visiblePredictions = new Map([...predictions].filter(([matchId]) => matches.some((match: any) => match.providerMatchId === matchId)));
  const base = { matches, predictions: Object.fromEntries(visiblePredictions), allPredicted: userId !== null && eligibleMatches.length > 0 && matches.length === 0, username: "", rank: "—", points: 0, exact: 0, clubName: null, rows: [], h2hTodayMatch: null };
  if (!userId) return NextResponse.json(base);
  const db = await getDb();
  const year = await getLatestSeasonStartYear();
  const [user, membership, todayMatch, mine, rows] = await Promise.all([
    db.collection<any>("users").findOne({ _id: new ObjectId(userId) }, { projection: { username: 1 } }),
    db.collection<any>("clubMemberships").findOne({ userId, leftAt: null }, { projection: { clubId: 1 } }),
    getViewerH2HTodayMatch(db, userId).catch(() => null),
    getLeaderboardSummary(db, userId, { seasonStartYear: year }),
    getCachedCanonicalLeaderboard(db, { seasonStartYear: year }, 7),
  ]);
  let clubName: string | null = null;
  if (membership && ObjectId.isValid(String(membership.clubId))) {
    const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(String(membership.clubId)) }, { projection: { name: 1 } });
    clubName = club?.name ?? null;
  }
  return NextResponse.json({ ...base, username: user?.username ?? "", rank: mine?.rank ?? "—", points: mine?.points ?? 0, exact: mine?.exact ?? 0, clubName, rows, h2hTodayMatch: todayMatch });
}
