import { NextResponse } from "next/server";
import { z } from "zod";
import { requireH2HAdmin } from "@/lib/auth/h2h-admin";
const body = z.object({ centralTeamId: z.string().min(1), rating: z.number().int().min(1).max(100) });
export async function PUT(request: Request) { const auth = await requireH2HAdmin(); if ("response" in auth) return auth.response; const parsed = body.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }); const now = new Date(); await auth.db.collection("centralTeams").updateOne({ centralTeamId: parsed.data.centralTeamId }, { $set: { h2hRating: parsed.data.rating, h2hRatingVersion: "manual", h2hRatingUpdatedAt: now } }); await auth.db.collection("h2hAuditEvents").insertOne({ type: "RATING_CHANGED", centralTeamId: parsed.data.centralTeamId, rating: parsed.data.rating, createdAt: now }); return NextResponse.json({ ok: true }); }
