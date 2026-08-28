import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { createAwardShareToken, hashAwardShareToken } from "@/lib/awards/shareToken";
export async function POST(_: Request, { params }: { params: Promise<{ awardId: string }> }) { const userId = await currentUserId(); const { awardId } = await params; if (!ObjectId.isValid(awardId)) return NextResponse.json({ error: "Award not found" }, { status: 404 }); const filter = userId ? { _id: new ObjectId(awardId), scope: "LOWBLOCK", userId } : { _id: new ObjectId(awardId), scope: "LOWBLOCK" }; const token = createAwardShareToken(); const result = await (await getDb()).collection("awards").updateOne(filter, { $set: { shareTokenHash: hashAwardShareToken(token), shareTokenCreatedAt: new Date() } }); if (!result.matchedCount) return NextResponse.json({ error: "Award not found" }, { status: 404 }); return NextResponse.json({ url: `https://lowblock.ir/s/${token}` }); }
