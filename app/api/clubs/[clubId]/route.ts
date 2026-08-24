import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";

export async function DELETE(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const userId = await currentUserId();
  const { clubId } = await params;
  if (!userId || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const db = await getDb();
  const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId), ownerId: userId });
  if (!club) return NextResponse.json({ error: "OWNER_PERMISSION_REQUIRED" }, { status: 403 });
  const members = await db.collection("clubMemberships").countDocuments({ clubId, leftAt: null });
  if (members > 1) return NextResponse.json({ error: "CLUB_HAS_MEMBERS" }, { status: 409 });
  await db.collection("clubMemberships").deleteMany({ clubId });
  await db.collection("clubJoinRequests").deleteMany({ clubId });
  await db.collection("clubInvitations").deleteMany({ clubId });
  await db.collection("clubs").deleteOne({ _id: club._id, ownerId: userId });
  return NextResponse.json({ ok: true });
}
