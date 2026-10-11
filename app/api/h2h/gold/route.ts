import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isH2HEnabled } from "@/lib/domain/h2h";

const body = z.object({ leagueId: z.string().min(1), matchday: z.number().int().min(1).max(7), matchId: z.string().min(1) });

export async function PUT(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isH2HEnabled()) return NextResponse.json({ error: "H2H_DISABLED" }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !ObjectId.isValid(parsed.data.leagueId)) return NextResponse.json({ error: "INVALID_GOLD_MATCH" }, { status: 400 });
  const db = await getDb();
  const league = await db.collection<any>("h2hLeagues").findOne({ _id: new ObjectId(parsed.data.leagueId), players: userId, status: "ACTIVE" });
  const slate = league?.slates?.find((item: any) => item.matchday === parsed.data.matchday);
  if (!league || !slate || !slate.fixtureIds.includes(parsed.data.matchId)) return NextResponse.json({ error: "INVALID_GOLD_MATCH" }, { status: 400 });
  if (new Date() >= new Date(slate.goldDeadline)) return NextResponse.json({ error: "GOLD_LOCKED" }, { status: 409 });
  await db.collection("h2hGoldPicks").updateOne(
    { leagueId: league._id, userId, matchday: parsed.data.matchday },
    { $set: { leagueId: league._id, userId, matchday: parsed.data.matchday, matchId: parsed.data.matchId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  return NextResponse.json({ ok: true, matchId: parsed.data.matchId });
}
