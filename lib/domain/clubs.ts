import { ObjectId, type Db } from "mongodb";
import type { ClubRecord, ClubMembershipRecord } from "@/lib/domain/types";

export const CLUB_MINIMUM_MEMBERS = 3;

export async function currentMembership(db: Db, userId: string) {
  return db.collection<ClubMembershipRecord>("clubMemberships").findOne({ userId, leftAt: null }, { sort: { joinedAt: -1 } });
}

export async function ownedClub(db: Db, userId: string) {
  return db.collection<ClubRecord>("clubs").findOne({ ownerId: userId });
}

export async function createClub(db: Db, userId: string, input: Pick<ClubRecord, "name" | "imageUrl" | "discoveryMode" | "visibility">) {
  if (await ownedClub(db, userId)) throw new Error("USER_ALREADY_OWNS_CLUB");
  if (await currentMembership(db, userId)) throw new Error("USER_ALREADY_IN_CLUB");
  const now = new Date();
  const result = await db.collection<ClubRecord>("clubs").insertOne({ ...input, ownerId: userId, state: "FORMING", activatedAt: null, createdAt: now, updatedAt: now });
  const clubId = String(result.insertedId);
  await db.collection<ClubMembershipRecord>("clubMemberships").insertOne({ clubId, userId, role: "OWNER", joinedAt: now, leftAt: null });
  return db.collection<ClubRecord>("clubs").findOne({ _id: result.insertedId });
}

export async function refreshClubState(db: Db, clubId: string) {
  const members = await db.collection("clubMemberships").countDocuments({ clubId, leftAt: null });
  if (members >= CLUB_MINIMUM_MEMBERS) await db.collection("clubs").updateOne({ _id: new ObjectId(clubId), state: "FORMING" }, { $set: { state: "ACTIVE", activatedAt: new Date(), updatedAt: new Date() } });
  return members;
}

export async function transferOwnership(db: Db, clubId: string, currentOwnerId: string, nextOwnerId: string) {
  const club = await db.collection<ClubRecord>("clubs").findOne({ _id: new ObjectId(clubId), ownerId: currentOwnerId });
  if (!club) throw new Error("OWNER_PERMISSION_REQUIRED");
  const member = await db.collection<ClubMembershipRecord>("clubMemberships").findOne({ clubId, userId: nextOwnerId, leftAt: null });
  if (!member) throw new Error("NEW_OWNER_MUST_BE_MEMBER");
  const now = new Date();
  await db.collection("clubs").updateOne({ _id: new ObjectId(clubId), ownerId: currentOwnerId }, { $set: { ownerId: nextOwnerId, updatedAt: now } });
  await db.collection("clubMemberships").updateOne({ _id: member._id }, { $set: { role: "OWNER" } });
  await db.collection("clubMemberships").updateOne({ clubId, userId: currentOwnerId, leftAt: null }, { $set: { role: "MEMBER" } });
}
