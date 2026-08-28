import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/mongo";
import { isPredictionLocked } from "@/lib/domain/predictionLock";
import { signGuestReceipt } from "@/lib/predictions/guestReceipt";
const body = z.object({ matchId: z.string().min(1), homeGoals: z.number().int().min(0).max(30), awayGoals: z.number().int().min(0).max(30) });
export async function POST(req: Request) { const parsed = body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "INVALID_PREDICTION" }, { status: 400 }); const match = await (await getDb()).collection<any>("matches").findOne({ provider: "football-api", providerMatchId: parsed.data.matchId, rawApiResponse: { $exists: true } }); if (!match) return NextResponse.json({ error: "MATCH_NOT_FOUND" }, { status: 404 }); if (isPredictionLocked(match)) return NextResponse.json({ error: "PREDICTION_LOCKED" }, { status: 409 }); const issuedAt = Date.now(); return NextResponse.json({ ok: true, receipt: signGuestReceipt({ ...parsed.data, issuedAt }) }); }
