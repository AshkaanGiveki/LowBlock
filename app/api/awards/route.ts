import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getAwardAsset } from "@/lib/awards/config";
export async function GET() {
  const userId = await currentUserId(); if (!userId || !ObjectId.isValid(userId)) return NextResponse.json({ awards: [] }, { status: 401 });
  const rows = await (await getDb()).collection<any>("awards").find({ userId, scope: { $in: ["LOWBLOCK", "CLUB"] } }).sort({ awardedAt: -1 }).toArray();
  return NextResponse.json({ awards: rows.map(({ _id, userId: owner, ...award }) => ({ id: String(_id), ...award, trophyUrl: `/api/awards/${String(_id)}/trophy`, shareImageUrl: `/api/awards/${String(_id)}/share-image`, assetAvailable: Boolean(getAwardAsset(award)) })) });
}
