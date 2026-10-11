import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isH2HEnabled } from "@/lib/domain/h2h";
export async function GET() { const userId = await currentUserId(); if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 }); if (!isH2HEnabled()) return NextResponse.json({ enabled: false, rewards: [] }); return NextResponse.json({ rewards: await (await getDb()).collection("h2hRewards").find({ userId }).sort({ createdAt: -1 }).limit(50).toArray() }); }
