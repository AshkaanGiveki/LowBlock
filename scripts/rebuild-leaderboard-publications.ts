import { closeMongo, ensureIndexes, ensurePerformanceIndexes, getDb } from "../lib/db/mongo";
import { publishLeaderboardSnapshots } from "../lib/domain/leaderboardPublisher";

/**
 * One-time deployment bootstrap and explicit recovery command.
 * Does NOT change prediction scores or erase existing historical points.
 */
async function main() {
  try {
    await ensureIndexes();
    await ensurePerformanceIndexes();
    const db = await getDb();
    const result = await publishLeaderboardSnapshots(db, { full: true });
    console.info(JSON.stringify({ event: "leaderboards.backfill", ...result }));
  } finally {
    await closeMongo();
  }
}

main().catch((error) => {
  console.error("leaderboard publication backfill failed:", error);
  process.exit(1);
});
