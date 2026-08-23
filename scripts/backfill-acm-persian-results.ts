import { closeMongo, getDb } from "../lib/db/mongo";
import { runScoreEngine } from "../lib/scoring/scoreEngine";

async function main() {
  try {
    const db = await getDb();
    const club = await db.collection<any>("clubs").findOne({ name: "ACMPersian" });
    if (!club) throw new Error("ACMPersian does not exist");
    const clubId = String(club._id);
    const activeMemberships = await db.collection<any>("clubMemberships").find({ clubId, leftAt: null }, { projection: { userId: 1, _id: 1 } }).toArray();
    const scoreEngine = await runScoreEngine();
    const scoreResult = await db.collection("predictionScores").updateMany({}, { $set: { clubIdAtLock: clubId } });
    const snapshotResult = await db.collection<any>("predictionLockSnapshots").updateMany({}, { $set: { clubIdAtLock: clubId } });
    for (const membership of activeMemberships) await db.collection("predictionLockSnapshots").updateMany({ userId: membership.userId, clubIdAtLock: clubId }, { $set: { membershipIdAtLock: String(membership._id) } });
    const scores = await db.collection("predictionScores").countDocuments({ clubIdAtLock: clubId });
    console.log(JSON.stringify({ club: club.name, activeMembers: activeMemberships.length, scoresUpdated: scoreResult.modifiedCount, snapshotsUpdated: snapshotResult.modifiedCount, clubScores: scores, scoreEngine }, null, 2));
  } finally { await closeMongo(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
