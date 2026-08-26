import { access } from "node:fs/promises";
import { ObjectId } from "mongodb";
import { getDb, closeMongo } from "../lib/db/mongo";
import { normalizeUsername } from "../lib/auth/username";
import { getRoundWinnerAsset, LOWBLOCK_SCOPE, ROUND_WINNER_TYPE } from "../lib/awards/config";

const usernameArg = process.argv.find(arg => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1]) ?? "@ashkan";
const remove = process.argv.includes("--remove");

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo awards are disabled in production.");
  const username = usernameArg.replace(/^@/, "");
  const db = await getDb();
  const user = await db.collection<{ _id: ObjectId; username: string }>("users").findOne({ normalizedUsername: normalizeUsername(username) }, { projection: { username: 1 } });
  if (!user) throw new Error(`User @${username} was not found.`);
  const asset = getRoundWinnerAsset("GB1", 2026, 1);
  if (!asset) throw new Error("Demo award asset mapping is missing.");
  await access(asset.trophy); await access(asset.shareCard);
  const filter = { userId: String(user._id), type: ROUND_WINNER_TYPE, scope: LOWBLOCK_SCOPE, competitionId: "GB1", seasonId: "2026", roundId: "GB1:2026:1", demo: true };
  if (remove) {
    const result = await db.collection("awards").deleteOne(filter);
    console.log(result.deletedCount ? `Removed demo award for @${user.username}.` : `No demo award found for @${user.username}.`);
  } else {
    const result = await db.collection("awards").updateOne(filter, { $setOnInsert: { ...filter, competitionName: asset.leagueName, seasonStartYear: 2026, roundNumber: 1, awardedAt: new Date(), revealedAt: null } }, { upsert: true });
    console.log(result.upsertedCount ? `Seeded unrevealed demo award for @${user.username}.` : `Demo award already exists for @${user.username}.`);
  }
  await closeMongo();
}
main().catch(async error => { console.error(error instanceof Error ? error.message : error); await closeMongo(); process.exit(1); });
