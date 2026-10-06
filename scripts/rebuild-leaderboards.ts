import { runScoreEngine } from "../lib/scoring/scoreEngine";
import { closeMongo, ensureIndexes, ensurePerformanceIndexes } from "../lib/db/mongo";

async function main() {
  try {
    await ensureIndexes();
    await ensurePerformanceIndexes();
    const result = await runScoreEngine();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeMongo();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "leaderboard rebuild failed");
  process.exit(1);
});
