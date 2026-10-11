import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isH2HEnabled } from "@/lib/domain/h2h";
import { ObjectId } from "mongodb";
export async function POST(request: Request) {
  const userId = await currentUserId(); if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isH2HEnabled()) return NextResponse.json({ error: "H2H_DISABLED" }, { status: 404 });
  const body = await request.json().catch(() => null) as any; const db = await getDb();
  const league = body?.leagueId && ObjectId.isValid(body.leagueId) ? await db.collection<any>("h2hLeagues").findOne({ _id: new ObjectId(body.leagueId), players: userId, status: { $in: ["ACTIVE", "PUBLISHED"] } }) : null;
  const fixture = league?.slates?.find((s: any) => s.matchday === Number(body?.matchday))?.fixtures?.find((f: any) => f.matchId === String(body?.matchId));
  if (!fixture || new Date() >= new Date(fixture.kickoffAt) || !Number.isInteger(body?.homeGoals) || !Number.isInteger(body?.awayGoals) || body.homeGoals < 0 || body.awayGoals < 0) return NextResponse.json({ error: "PREDICTION_LOCKED_OR_INVALID" }, { status: 409 });
  await db.collection("predictions").updateOne({ userId, matchId: fixture.matchId }, { $set: { userId, matchId: fixture.matchId, homeGoals: body.homeGoals, awayGoals: body.awayGoals, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true });
}
