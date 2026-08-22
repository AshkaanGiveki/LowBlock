import { ObjectId } from "mongodb";
import { getDb, withMongoTransaction } from "../lib/db/mongo";

const CLUB_NAME = "ACMPersian";

async function main() {
  const db = await getDb();
  const ashkan = await db.collection<any>("users").findOne({ $or: [{ normalizedUsername: "ashkan" }, { username: { $regex: /^ashkan$/i } }] });
  if (!ashkan) throw new Error("Could not find the Ashkan user. No changes were made.");
  const userIds = (await db.collection<any>("users").find({}, { projection: { _id: 1 } }).toArray()).map((user) => String(user._id));
  if (!userIds.length) throw new Error("No users found. No changes were made.");

  const result = await withMongoTransaction(async (transactionDb, session) => {
    const now = new Date();
    let club = await transactionDb.collection<any>("clubs").findOne({ name: CLUB_NAME }, { session });
    if (!club) {
      const inserted = await transactionDb.collection("clubs").insertOne({ name: CLUB_NAME, imageUrl: null, state: "FORMING", discoveryMode: "INVITE_ONLY", visibility: "PUBLIC", ownerId: String(ashkan._id), activatedAt: null, createdAt: now, updatedAt: now }, { session });
      club = { _id: inserted.insertedId, name: CLUB_NAME };
    }
    const clubId = String(club._id);
    const existingOwner = await transactionDb.collection<any>("clubs").findOne({ ownerId: String(ashkan._id), _id: { $ne: club._id } }, { session });
    if (existingOwner) {
      const replacement = await transactionDb.collection<any>("clubMemberships").findOne({ clubId: String(existingOwner._id), userId: { $ne: String(ashkan._id) }, leftAt: null }, { session });
      if (!replacement) throw new Error(`Ashkan owns another Club (${existingOwner.name}) with no member available for ownership transfer.`);
      await transactionDb.collection("clubs").updateOne({ _id: existingOwner._id }, { $set: { ownerId: replacement.userId, updatedAt: now } }, { session });
      await transactionDb.collection("clubMemberships").updateOne({ _id: replacement._id }, { $set: { role: "OWNER" } }, { session });
    }
    await transactionDb.collection("clubs").updateOne({ _id: club._id }, { $set: { ownerId: String(ashkan._id), visibility: "PUBLIC", updatedAt: now } }, { session });
    let added = 0;
    for (const userId of userIds) {
      const active = await transactionDb.collection<any>("clubMemberships").findOne({ userId, leftAt: null }, { session });
      if (active && active.clubId !== clubId) await transactionDb.collection("clubMemberships").updateOne({ _id: active._id, leftAt: null }, { $set: { leftAt: now } }, { session });
      const current = await transactionDb.collection<any>("clubMemberships").findOne({ userId, clubId, leftAt: null }, { session });
      if (!current) { await transactionDb.collection("clubMemberships").insertOne({ clubId, userId, role: userId === String(ashkan._id) ? "OWNER" : "MEMBER", joinedAt: now, leftAt: null }, { session }); added++; }
      else await transactionDb.collection("clubMemberships").updateOne({ _id: current._id }, { $set: { role: userId === String(ashkan._id) ? "OWNER" : "MEMBER" } }, { session });
    }
    const memberCount = await transactionDb.collection("clubMemberships").countDocuments({ clubId, leftAt: null }, { session });
    await transactionDb.collection("clubs").updateOne({ _id: club._id }, { $set: { state: memberCount >= 3 ? "ACTIVE" : "FORMING", activatedAt: memberCount >= 3 ? (club.activatedAt ?? now) : null, updatedAt: now } }, { session });
    return { clubId, memberCount, added, ashkanId: String(ashkan._id) };
  });
  const finalClub = await db.collection<any>("clubs").findOne({ _id: new ObjectId(result.clubId) });
  const activeMembers = await db.collection("clubMemberships").countDocuments({ clubId: result.clubId, leftAt: null });
  console.log(JSON.stringify({ ...result, club: finalClub?.name, state: finalClub?.state, activeMembers }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
