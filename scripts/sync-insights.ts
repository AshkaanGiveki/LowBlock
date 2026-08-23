import { closeMongo, getDb } from "../lib/db/mongo";
import { syncMatchInsights } from "../lib/football/api-sports/matchInsights";

async function main() {
  try {
    const result = await syncMatchInsights(await getDb(), { force: process.env.SYNC_INSIGHTS_FORCE !== "false" });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeMongo();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "insight sync failed");
  process.exit(1);
});
