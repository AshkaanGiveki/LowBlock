import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { createAwardShareToken, hashAwardShareToken } from "@/lib/awards/shareToken";
import { getAwardShareMessage } from "@/lib/awards/shareCopy";

export async function POST(request: Request, { params }: { params: Promise<{ awardId: string }> }) {
  const { awardId } = await params;
  if (!ObjectId.isValid(awardId)) return NextResponse.json({ error: "Award not found" }, { status: 404 });
  const db = await getDb();
  // Awards are publicly shareable; ownership is enforced by the private
  // trophy/download route, while this endpoint only creates a public token.
  const filter = { _id: new ObjectId(awardId), scope: { $in: ["LOWBLOCK", "CLUB"] } };
  const award = await db.collection<any>("awards").findOne(filter, { projection: { shareCopyIndex: 1, shareToken: 1, shareTokenHash: 1 } });
  if (!award) return NextResponse.json({ error: "Award not found" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "fa";
  if (typeof award.shareToken === "string" && /^[A-Za-z0-9_-]{6}$/.test(award.shareToken)) return NextResponse.json({ url: `https://lowblock.ir/s/${award.shareToken}`, message: getAwardShareMessage(locale, award.shareCopyIndex) });
  for (let attempt = 0; attempt < 8; attempt++) { const token = createAwardShareToken(); const tokenTaken = await db.collection("awards").findOne({ shareTokenHash: hashAwardShareToken(token) }, { projection: { _id: 1 } }); if (tokenTaken) continue; const result = await db.collection("awards").updateOne(filter, { $set: { shareToken: token, shareTokenHash: hashAwardShareToken(token), shareTokenCreatedAt: new Date() } }); if (result.matchedCount) return NextResponse.json({ url: `https://lowblock.ir/s/${token}`, message: getAwardShareMessage(locale, award.shareCopyIndex) }); return NextResponse.json({ error: "Award not found" }, { status: 404 }); }
  return NextResponse.json({ error: "Could not create share link" }, { status: 503 });
}
