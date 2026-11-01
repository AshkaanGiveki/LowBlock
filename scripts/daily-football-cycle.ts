import { closeMongo } from "../lib/db/mongo";
import { runDailyFootballCycle } from "../lib/worker/dailyCycle";

/** Server-owned nightly sync; intentionally independent of Vercel Cron/QStash. */
async function main() {
  try {
    const result = await runDailyFootballCycle();
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await closeMongo();
  }
}

main().catch((error) => {
  console.error("daily_football_cycle_failed", error);
  process.exitCode = 1;
});
