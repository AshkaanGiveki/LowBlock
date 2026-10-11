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
  const membership = await db.collection<any>("clubMemberships").findOne({ userId, leftAt: null });
  if (!membership) return NextResponse.json({ enabled: true, league: null, reason: "NO_CLUB" });
  const week = getH2HWeek();
  const league = await db.collection<any>("h2hLeagues").findOne({ clubId: membership.clubId, weekKey: week.key, players: userId });
  if (!league) return NextResponse.json({ enabled: true, league: null, weekKey: week.key, reason: "NOT_CREATED" });
  return NextResponse.json({ enabled: true, league: await publicH2HLeague(db, league, userId) });
}
