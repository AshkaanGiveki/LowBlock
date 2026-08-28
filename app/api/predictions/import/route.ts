import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { verifyGuestReceipt } from "@/lib/predictions/guestReceipt";
import { upsertPrediction } from "@/lib/domain/predictions";
const body = z.object({ receipts: z.array(z.string().min(20)).max(100) });
export async function POST(req: Request) {
  const userId = await currentUserId(); if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "INVALID_RECEIPTS" }, { status: 400 });
  const db = await getDb(); const imported: string[] = []; const handled: string[] = []; const discarded: string[] = [];
  for (const receipt of parsed.data.receipts) { const payload = verifyGuestReceipt(receipt); if (!payload) { discarded.push(receipt); continue; } const match = await db.collection<any>("matches").findOne({ provider: "football-api", providerMatchId: payload.matchId, rawApiResponse: { $exists: true } }); if (!match || payload.issuedAt > new Date(match.kickoffAt).getTime() + 60_000) continue; const existing = await db.collection("predictions").findOne({ userId, matchId: payload.matchId }); if (!existing) { await upsertPrediction(db, userId, payload); imported.push(payload.matchId); } handled.push(payload.matchId); }
  return NextResponse.json({ ok: true, imported, handled, discarded });
}
