import { access } from "node:fs/promises";
import { getDb, closeMongo } from "../lib/db/mongo";
import { getClubWeeklyAsset, CLUB_WEEKLY_WINNER_TYPE } from "../lib/awards/config";
import { normalizeUsername } from "../lib/auth/username";

async function main() {
  await access(getClubWeeklyAsset().trophy);
  await access(getClubWeeklyAsset().shareCard);
  const db = await getDb();
  const user = await db.collection<any>("users").findOne({ normalizedUsername: normalizeUsername("ashkan") }, { projection: { username: 1 } });
  if (!user) throw new Error("User @ashkan was not found.");
  const club = await db.collection<any>("clubs").findOne({ name: /^acmpersian$/i }, { projection: { name: 1 } });
  if (!club) throw new Error("Club acmpersian was not found.");
  const membership = await db.collection<any>("clubMemberships").findOne({ userId: String(user._id), clubId: String(club._id), leftAt: null });
  if (!membership) throw new Error("@ashkan is not an active member of acmpersian.");
  const start = new Date("2026-08-21T00:00:00.000Z");
  const end = new Date("2026-08-28T00:00:00.000Z");
  const scored = await db.collection<any>("predictionScores").aggregate([{ $match: { userId: String(user._id), clubIdAtLock: String(club._id) } }, { $lookup: { from: "matches", localField: "matchId", foreignField: "providerMatchId", as: "match" } }, { $unwind: "$match" }, { $match: { "match.kickoffAt": { $gte: start, $lt: end } } }, { $group: { _id: null, points: { $sum: "$points" }, predictions: { $sum: 1 }, exact: { $sum: { $cond: ["$exactScore", 1, 0] } } } }]).toArray();
  const stats = scored[0] ?? { points: 0, predictions: 0, exact: 0 };
  const filter = { userId: String(user._id), type: CLUB_WEEKLY_WINNER_TYPE, scope: "CLUB", clubId: String(club._id), periodId: "21-27Aug", seasonStartYear: 2026 };
  await db.collection("awards").updateOne(filter, { $set: { revealedAt: null, points: Number(stats.points), predictions: Number(stats.predictions), exact: Number(stats.exact), clubName: club.name, competitionName: "Weekly", awardedAt: new Date() }, $setOnInsert: { ...filter, awardLabel: "WEEKLY WINNER", assetKey: "CLUB_WEEKLY_21_27_AUG" } }, { upsert: true });
  console.log(`Seeded unrevealed Weekly Club award for @${user.username} in ${club.name}. Points: ${stats.points}`);
  await closeMongo();
}

main().catch(async error => { console.error(error instanceof Error ? error.message : error); await closeMongo(); process.exit(1); });
