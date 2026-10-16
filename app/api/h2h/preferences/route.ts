import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getH2HWeek, isH2HEnabled } from "@/lib/domain/h2h";
import { z } from "zod";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const user = await (await getDb()).collection<any>("users").findOne({ _id: new ObjectId(userId) }, { projection: { h2hOptOut: 1, h2hOptOutEffectiveWeekKey: 1 } });
  return NextResponse.json({ enabled: isH2HEnabled(), optedIn: !(user?.h2hOptOut === true && String(user.h2hOptOutEffectiveWeekKey ?? "") <= getH2HWeek().key), h2hOptOut: user?.h2hOptOut === true, effectiveWeekKey: user?.h2hOptOutEffectiveWeekKey ?? null });
}

export async function PUT(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const parsed = z.object({ optedIn: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_PREFERENCE" }, { status: 400 });
  const db = await getDb();
  const nextWeek = getH2HWeek(new Date(Date.now() + 7 * 86400000));
  await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { h2hOptOut: !parsed.data.optedIn, h2hOptOutEffectiveWeekKey: nextWeek.key, updatedAt: new Date() } });
  return NextResponse.json({ ok: true, optedIn: parsed.data.optedIn, effectiveWeekKey: nextWeek.key });
}
