import { ObjectId, type Db } from "mongodb";
import type { ClubRecord, ClubMembershipRecord } from "@/lib/domain/types";
import { withMongoTransaction } from "@/lib/db/mongo";

// Minimum active membership required for a club to activate and participate.
export const CLUB_MINIMUM_MEMBERS = 3;

export async function currentMembership(db: Db, userId: string) {
  return db.collection<ClubMembershipRecord>("clubMemberships").findOne({ userId, leftAt: null }, { sort: { joinedAt: -1 } });
}

export async function requireClubMember(db: Db, clubId: string, userId: string) {
  const club = await db.collection<ClubRecord>("clubs").findOne({ _id: new ObjectId(clubId) });
  if (!club) throw new Error("CLUB_NOT_FOUND");
  const membership = await currentMembership(db, userId);
  if (!membership || membership.clubId !== clubId) throw new Error("CLUB_MEMBERSHIP_REQUIRED");
  return { club, membership };
}

export async function ownedClub(db: Db, userId: string) {
  return db.collection<ClubRecord>("clubs").findOne({ ownerId: userId });
}

export async function createClub(db: Db, userId: string, input: Pick<ClubRecord, "name" | "imageUrl" | "discoveryMode" | "visibility">) {
  const clubId = await withMongoTransaction(async (transactionDb, session) => { if (await transactionDb.collection("clubs").findOne({ ownerId: userId }, { session })) throw new Error("USER_ALREADY_OWNS_CLUB"); if (await transactionDb.collection("clubMemberships").findOne({ userId, leftAt: null }, { session })) throw new Error("USER_ALREADY_IN_CLUB"); if (await transactionDb.collection("clubJoinRequests").findOne({ userId, status: "PENDING" }, { session })) throw new Error("PENDING_JOIN_REQUEST"); const now = new Date(); const result = await transactionDb.collection<ClubRecord>("clubs").insertOne({ ...input, ownerId: userId, state: "FORMING", activatedAt: null, createdAt: now, updatedAt: now }, { session }); await transactionDb.collection<ClubMembershipRecord>("clubMemberships").insertOne({ clubId: String(result.insertedId), userId, role: "OWNER", joinedAt: now, leftAt: null }, { session }); return result.insertedId; }); return db.collection<ClubRecord>("clubs").findOne({ _id: clubId });
}

export async function refreshClubState(db: Db, clubId: string) {
  const members = await db.collection("clubMemberships").countDocuments({ clubId, leftAt: null });
  if (members >= CLUB_MINIMUM_MEMBERS) await db.collection("clubs").updateOne({ _id: new ObjectId(clubId), state: "FORMING" }, { $set: { state: "ACTIVE", activatedAt: new Date(), updatedAt: new Date() } });
  return members;
}

export async function transferOwnership(db: Db, clubId: string, currentOwnerId: string, nextOwnerId: string) {
  await withMongoTransaction(async (transactionDb, session) => { const club = await transactionDb.collection<ClubRecord>("clubs").findOne({ _id: new ObjectId(clubId), ownerId: currentOwnerId }, { session }); if (!club) throw new Error("OWNER_PERMISSION_REQUIRED"); const member = await transactionDb.collection<ClubMembershipRecord>("clubMemberships").findOne({ clubId, userId: nextOwnerId, leftAt: null }, { session }); if (!member) throw new Error("NEW_OWNER_MUST_BE_MEMBER"); const now = new Date(); const result = await transactionDb.collection("clubs").updateOne({ _id: new ObjectId(clubId), ownerId: currentOwnerId }, { $set: { ownerId: nextOwnerId, updatedAt: now } }, { session }); if (result.modifiedCount !== 1) throw new Error("OWNERSHIP_CHANGED"); await transactionDb.collection("clubMemberships").updateOne({ _id: member._id }, { $set: { role: "OWNER" } }, { session }); await transactionDb.collection("clubMemberships").updateOne({ clubId, userId: currentOwnerId, leftAt: null }, { $set: { role: "MEMBER" } }, { session }); });
}
