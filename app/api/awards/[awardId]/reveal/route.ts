import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
export async function PATCH(_: Request, { params }: { params: Promise<{ awardId: string }> }) { const userId = await currentUserId(); const { awardId } = await params; if (!userId || !ObjectId.isValid(userId) || !ObjectId.isValid(awardId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const result = await (await getDb()).collection("awards").updateOne({ _id: new ObjectId(awardId), userId }, { $set: { revealedAt: new Date() } }); if (!result.matchedCount) return NextResponse.json({ error: "Award not found" }, { status: 404 }); return NextResponse.json({ ok: true }); }
