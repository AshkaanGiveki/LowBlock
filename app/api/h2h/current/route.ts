import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getH2HWeek, isH2HEnabled, publicH2HLeague } from "@/lib/domain/h2h";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isH2HEnabled()) return NextResponse.json({ enabled: false, league: null });
  const db = await getDb();
  const testLeague = await db.collection<any>("h2hLeagues").findOne({ weekKey: getH2HWeek().key, players: userId, testRound: true, status: "ACTIVE" });
  if (testLeague) return NextResponse.json({ enabled: true, league: await publicH2HLeague(db, testLeague, userId), viewerIncluded: true, testRound: true });
  const membership = await db.collection<any>("clubMemberships").findOne({ userId, leftAt: null });
  const week = getH2HWeek();
  if (!membership) return NextResponse.json({ enabled: true, league: null, weekKey: week.key, reason: "NO_CLUB" });
  const clubMemberCount = await db.collection<any>("clubMemberships").countDocuments({ clubId: membership.clubId, leftAt: null });
  const league = await db.collection<any>("h2hLeagues").findOne({ clubId: membership.clubId, weekKey: week.key, groupNumber: 1 });
  if (!league) return NextResponse.json({ enabled: true, league: null, weekKey: week.key, reason: clubMemberCount < 8 ? "CLUB_TOO_SMALL" : "NOT_CREATED", clubMemberCount });
  return NextResponse.json({ enabled: true, league: await publicH2HLeague(db, league, userId), viewerIncluded: league.players.map(String).includes(String(userId)), clubMemberCount });
}
