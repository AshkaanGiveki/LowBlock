import { getDb } from "../lib/db/mongo";
import { env } from "../lib/env";

async function main() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const db = await getDb();
  await db.collection("awards").createIndex({ userId: 1, type: 1, scope: 1, competitionId: 1, seasonId: 1, roundId: 1 }, { unique: true, name: "unique_lowblock_award" });
  await db.collection("awards").createIndex({ userId: 1, revealedAt: 1 }, { name: "awards_by_owner_and_reveal" });
  console.log("Awards indexes created.");
}
main().catch(error => { console.error(error); process.exit(1); });
