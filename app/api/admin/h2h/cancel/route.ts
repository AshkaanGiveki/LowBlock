import { NextResponse } from "next/server";
import { z } from "zod";
import { requireH2HAdmin } from "@/lib/auth/h2h-admin";
const body = z.object({ weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().min(3).max(500) });
export async function POST(request: Request) {
  const auth = await requireH2HAdmin(); if ("response" in auth) return auth.response;
  const parsed = body.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const now = new Date();
  await auth.db.collection("h2hLeagues").updateMany({ weekKey: parsed.data.weekKey, status: { $in: ["DRAFT", "ACTIVE"] } }, { $set: { status: "CANCELLED", cancelledReason: parsed.data.reason, updatedAt: now } });
  await auth.db.collection("h2hWeeks").updateOne({ weekKey: parsed.data.weekKey }, { $set: { weekKey: parsed.data.weekKey, status: "CANCELLED", cancelledReason: parsed.data.reason, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
  return NextResponse.json({ ok: true, weekKey: parsed.data.weekKey });
}
