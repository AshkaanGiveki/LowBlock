import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isH2HEnabled, publicH2HLeague } from "@/lib/domain/h2h";
export async function GET(_: Request, context: { params: Promise<{ matchdayId: string }> }) {
  const userId = await currentUserId(); const { matchdayId } = await context.params;
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isH2HEnabled() || !ObjectId.isValid(matchdayId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const db = await getDb(); const league = await db.collection<any>("h2hLeagues").findOne({ _id: new ObjectId(matchdayId), players: userId });
  if (!league) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ league: await publicH2HLeague(db, league, userId) });
}
