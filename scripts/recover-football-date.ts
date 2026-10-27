import { getFootballProvider } from "../lib/football/providerRegistry";
import { runScoreEngine } from "../lib/scoring/scoreEngine";
import { closeMongo } from "../lib/db/mongo";

const dateKey = process.argv[2];

if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey ?? "")) {
  throw new Error("Usage: npm run recover:football-date -- YYYY-MM-DD");
}

async function main() {
  try {
    const provider = getFootballProvider();
    const sync = await provider.syncDate(dateKey!, { deferScoring: true });
    const scoring = await runScoreEngine({ rebuildLeaderboards: true });
    console.log(JSON.stringify({ ok: true, dateKey, sync, scoring }, null, 2));
  } finally {
    await closeMongo();
  }
}

main().catch((error) => {
  console.error("football_date_recovery_failed", error);
  process.exitCode = 1;
});
