import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getH2HWeek, isH2HEnabled } from "@/lib/domain/h2h";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isH2HEnabled()) return NextResponse.json({ enabled: false, league: null });
  const db = await getDb();
  const week = getH2HWeek();
  const testLeague = await db.collection<any>("h2hLeagues").findOne({ weekKey: week.key, players: userId, testRound: true, status: "ACTIVE" }, { projection: { _id: 1, weekKey: 1, status: 1 } });
  if (testLeague) return NextResponse.json({ enabled: true, weekKey: week.key, league: { id: String(testLeague._id), weekKey: testLeague.weekKey }, viewerIncluded: true, testRound: true, availableWeeks: [testLeague.weekKey] });
  const membership = await db.collection<any>("clubMemberships").findOne({ userId, leftAt: null });
  if (!membership) return NextResponse.json({ enabled: true, league: null, weekKey: week.key, reason: "NO_CLUB" });
  const [clubMemberCount, league, clubWeeks] = await Promise.all([
    db.collection<any>("clubMemberships").countDocuments({ clubId: membership.clubId, leftAt: null }),
    db.collection<any>("h2hLeagues").findOne({ clubId: membership.clubId, weekKey: week.key, groupNumber: 1 }, { projection: { _id: 1, weekKey: 1, status: 1, players: 1 } }),
    db.collection<any>("h2hLeagues").find({ clubId: membership.clubId, groupNumber: 1 }, { projection: { weekKey: 1 } }).sort({ weekKey: -1 }).limit(8).toArray(),
  ]);
  const availableWeeks = [...new Set([week.key, ...clubWeeks.map((item) => String(item.weekKey))])];
  if (!league) return NextResponse.json({ enabled: true, league: null, weekKey: week.key, reason: clubMemberCount < 8 ? "CLUB_TOO_SMALL" : "NOT_CREATED", clubMemberCount, availableWeeks });
  if (league.status !== "ACTIVE") {
    return NextResponse.json({ enabled: true, league: null, weekKey: week.key, reason: "NEXT_WEEK", clubMemberCount, availableWeeks });
  }
  return NextResponse.json({ enabled: true, weekKey: week.key, league: { id: String(league._id), weekKey: league.weekKey }, viewerIncluded: league.players.map(String).includes(String(userId)), clubMemberCount, availableWeeks });
}
