import { closeMongo, ensureH2HIndexes, ensureIndexes } from "../lib/db/mongo";
import { runWorkerCycle } from "../lib/worker/localWorker";

const once = process.argv.includes("--once");
const intervalMs = Math.max(15_000, Number(process.env.WORKER_INTERVAL_MS || 60_000));

async function cycle() {
  try {
    const result = await runWorkerCycle();
    console.log(JSON.stringify({ worker: "lowblock", at: new Date().toISOString(), ...result }));
  } catch (error) {
    console.error("lowblock_worker_cycle_failed", error);
  }
}

async function main() {
  console.info(JSON.stringify({
    type: "lowblock.worker.started",
    pid: process.pid,
    once,
    intervalMs,
    timezone: process.env.APP_TIMEZONE || "Asia/Tehran",
    provider: process.env.FOOTBALL_DATA_PROVIDER || "unset",
  }));
  await ensureIndexes();
  await ensureH2HIndexes();
  if (!once && process.env.FOOTBALL_DATA_PROVIDER === "sportsapi" && process.env.VERCEL !== "1") {
    const { startLiveIngestionOwnership } = await import("../lib/football/sportsapi/ownerLease");
    await startLiveIngestionOwnership();
  }
  console.info(JSON.stringify({ type: "lowblock.worker.ready", pid: process.pid }));
  // Historical intelligence is materialized by the worker, not computed for viewers.
  const refreshIntelligence = async () => {
    try {
      const { getDb } = await import("../lib/db/mongo");
      const { refreshLocalMatchIntelligence } = await import("../lib/football/intelligence/history");
      const { syncVerifiedSportsApiStandings } = await import("../lib/football/intelligence/standings");
      const db = await getDb();
      const officialTables = await syncVerifiedSportsApiStandings(db);
      const results = await refreshLocalMatchIntelligence(db);
      console.info(JSON.stringify({ type: "lowblock.intelligence.official_standings", ...officialTables }));
      console.info(JSON.stringify({ type: "lowblock.intelligence.refreshed", ...results }));
    } catch (error) {
      console.error("lowblock_intelligence_refresh_failed", error);
    }
  };
  if (!once) {
    await refreshIntelligence();
    // Every hour; historic snapshots remain in MongoDB between worker cycles.
    const historicalTimer = setInterval(refreshIntelligence, 60 * 60_000);
    historicalTimer.unref?.();
  }
  await cycle();
  if (once) return;
  const timer = setInterval(cycle, intervalMs);
  // Keep the worker process alive across the overnight schedule window.
  // An unresolved Promise does not keep Node alive when the interval is
  // unref'ed, so the old code could silently exit between cycles.
  await new Promise<void>(() => undefined);
}

main().catch((error) => {
  console.error("lowblock_worker_failed", error);
  process.exitCode = 1;
}).finally(async () => {
  if (once) await closeMongo();
});
