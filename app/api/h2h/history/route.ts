import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isH2HEnabled } from "@/lib/domain/h2h";
export async function GET() {
  const userId = await currentUserId(); if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isH2HEnabled()) return NextResponse.json({ enabled: false, leagues: [] });
  const leagues = await (await getDb()).collection<any>("h2hLeagues").find({ players: userId, status: "COMPLETED" }, { projection: { weekKey: 1, clubId: 1, groupNumber: 1, winnerUserId: 1, status: 1 } }).sort({ weekKey: -1 }).limit(20).toArray();
  return NextResponse.json({ leagues });
}
