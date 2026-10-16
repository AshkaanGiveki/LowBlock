import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isH2HEnabled } from "@/lib/domain/h2h";
export async function GET(_: Request, context: { params: Promise<{ weekId: string }> }) {
  const userId = await currentUserId(); const { weekId } = await context.params;
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isH2HEnabled()) return NextResponse.json({ enabled: false }, { status: 404 });
  const db = await getDb(); const week = await db.collection<any>("h2hWeeks").findOne({ $or: [{ _id: weekId }, { weekKey: weekId }] });
  const leagues = await db.collection<any>("h2hLeagues").find({ weekKey: weekId, players: userId }, { projection: { players: 1, clubId: 1, groupNumber: 1, status: 1 } }).toArray();
  return NextResponse.json({ week, leagues });
}
