import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";

const body = z.object({ imageData: z.string().nullable() });

export async function PATCH(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const userId = await currentUserId(); const { clubId } = await params;
  if (!userId || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid Club image" }, { status: 400 });
  const imageData = parsed.data.imageData?.trim() ?? null;
  if (imageData && (!/^data:image\/(png|jpe?g|webp);base64,/i.test(imageData) || imageData.length > 2_800_000)) return NextResponse.json({ error: "Use a PNG, JPEG, or WebP image under 2 MB" }, { status: 400 });
  const db = await getDb(); const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId) });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
  if (club.ownerId !== userId) return NextResponse.json({ error: "Owner permission required" }, { status: 403 });
  await db.collection("clubs").updateOne({ _id: club._id, ownerId: userId }, { $set: { imageUrl: imageData, updatedAt: new Date() } });
  return NextResponse.json({ ok: true, imageUrl: imageData });
}
