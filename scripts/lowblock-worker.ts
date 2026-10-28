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
  await ensureIndexes();
  await ensureH2HIndexes();
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
