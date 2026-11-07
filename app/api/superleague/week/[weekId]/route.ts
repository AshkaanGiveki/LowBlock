import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isH2HEnabled, publicH2HLeague } from "@/lib/domain/h2h";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ weekId: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isH2HEnabled()) return NextResponse.json({ enabled: false }, { status: 404 });
  const { weekId } = await params;
  const db = await getDb();
  const membership = await db.collection<any>("clubMemberships").findOne({ userId, leftAt: null }, { projection: { clubId: 1 } });
  if (!membership) return NextResponse.json({ error: "NO_CLUB" }, { status: 404 });
  const league = await db.collection<any>("h2hLeagues").findOne({ clubId: membership.clubId, weekKey: weekId, groupNumber: 1 });
  if (!league) return NextResponse.json({ enabled: true, league: null, weekKey: weekId });
  return NextResponse.json({ enabled: true, weekKey: weekId, league: await publicH2HLeague(db, league, userId), viewerIncluded: league.players.map(String).includes(String(userId)) });
}
