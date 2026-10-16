import { NextResponse } from "next/server";
import { z } from "zod";
import { requireH2HAdmin } from "@/lib/auth/h2h-admin";
const body = z.object({ code: z.string().min(1), weight: z.number().min(1).max(1.2) });
export async function PUT(request: Request) { const auth = await requireH2HAdmin(); if ("response" in auth) return auth.response; const parsed = body.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }); const now = new Date(); await auth.db.collection("h2hTournamentWeights").updateOne({ code: parsed.data.code }, { $set: { code: parsed.data.code, weight: parsed.data.weight, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); await auth.db.collection("h2hAuditEvents").insertOne({ type: "TOURNAMENT_WEIGHT_CHANGED", code: parsed.data.code, weight: parsed.data.weight, createdAt: now }); return NextResponse.json({ ok: true }); }
