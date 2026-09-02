import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { refreshClubState, transferOwnership } from "@/lib/domain/clubs";
import { getDefendingChampionUserId } from "@/lib/awards/defendingChampion";

export async function GET(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const viewer = await currentUserId();
  const { clubId } = await params;
  if (!viewer || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const membership = await db.collection<any>("clubMemberships").findOne({ clubId, userId: viewer, leftAt: null });
  const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId) }, { projection: { name: 1, ownerId: 1, state: 1, discoveryMode: 1, visibility: 1, imageUrl: 1, leaderboardCompetitionCodes: 1 } });
  if (!club || !membership) return NextResponse.json({ error: "Club membership required" }, { status: 403 });
  const members = await db.collection<any>("clubMemberships").aggregate([
    { $match: { clubId, leftAt: null } },
    { $sort: { role: -1, joinedAt: 1 } },
    { $lookup: { from: "users", let: { userId: "$userId" }, pipeline: [{ $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] } } }, { $project: { username: 1, avatarUrl: 1 } }], as: "user" } },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
  ]).toArray();
  const championId = await getDefendingChampionUserId(db);
  return NextResponse.json({ club, members: members.map((member) => ({ ...member, isDefendingChampion: String(member.userId) === championId })), isOwner: club.ownerId === viewer });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const actor = await currentUserId();
  const { clubId } = await params;
  if (!actor || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const data = await req.json().catch(() => ({}));
  const targetUserId = typeof data.userId === "string" ? data.userId : actor;
  const db = await getDb();
  const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId) });
  if (!club) return NextResponse.json({ error: "CLUB_NOT_FOUND" }, { status: 404 });
  const isOwner = club.ownerId === actor;
  const isSelf = targetUserId === actor;
  if (!isSelf && !isOwner) return NextResponse.json({ error: "OWNER_PERMISSION_REQUIRED" }, { status: 403 });

  if (isSelf && isOwner) {
    const members = await db.collection("clubMemberships").countDocuments({ clubId, leftAt: null });
    if (members > 1) return NextResponse.json({ error: "TRANSFER_OWNERSHIP_FIRST" }, { status: 409 });
    await db.collection("clubMemberships").deleteMany({ clubId });
    await db.collection("clubJoinRequests").deleteMany({ clubId });
    await db.collection("clubInvitations").deleteMany({ clubId });
    await db.collection("clubs").deleteOne({ _id: club._id, ownerId: actor });
    return NextResponse.json({ ok: true, clubClosed: true });
  }

  const result = await db.collection("clubMemberships").updateOne({ clubId, userId: targetUserId, leftAt: null }, { $set: { leftAt: new Date() } });
  if (!result.matchedCount) return NextResponse.json({ error: "ALREADY_MEMBER" }, { status: 404 });
  await refreshClubState(db, clubId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const actor = await currentUserId();
  const { clubId } = await params;
  if (!actor || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const data = await req.json().catch(() => ({}));
  if (data.action !== "TRANSFER" || typeof data.userId !== "string") return NextResponse.json({ error: "INVALID_OWNERSHIP_TRANSFER" }, { status: 400 });
  try {
    await transferOwnership(await getDb(), clubId, actor, data.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "TRANSFER_FAILED";
    return NextResponse.json({ error: code }, { status: 409 });
  }
}
