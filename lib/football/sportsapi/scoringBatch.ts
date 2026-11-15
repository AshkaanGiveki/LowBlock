import { getDb } from "@/lib/db/mongo";

// Coalesce finished fixtures into one idempotent scoring pass. A Mongo lease
// serializes workers, and a trailing request is never discarded while a pass
// is already running or another worker temporarily owns the lease.
const BATCH_DELAY_MS = 30_000;
const LEASE_MS = 10 * 60_000;
const RENEW_MS = 60_000;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let requestedDuringRun = false;

function schedule(delayMs: number): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushFinishedMatchScoring();
  }, delayMs);
  timer.unref?.();
}

export function queueFinishedMatchScoring(): void {
  if (running) {
    requestedDuringRun = true;
    return;
  }
  schedule(BATCH_DELAY_MS);
}

export async function flushFinishedMatchScoring(): Promise<void> {
  if (running) {
    requestedDuringRun = true;
    return;
  }
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  running = true;
  const owner = `${process.pid}:${Math.random().toString(36).slice(2)}`;
  let acquired = false;
  let shouldRetry = false;
  let renewal: ReturnType<typeof setInterval> | null = null;
  try {
    const db = await getDb();
    const leases = db.collection<any>("lowblockWorkerLeases");
    const now = new Date();
    await leases.updateOne(
      { _id: "finished-match-scoring" },
      { $setOnInsert: { expiresAt: new Date(0), createdAt: now } },
      { upsert: true },
    );
    const lease = await leases.findOneAndUpdate(
      {
        _id: "finished-match-scoring",
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      { $set: { owner, expiresAt: new Date(now.getTime() + LEASE_MS), updatedAt: now } },
      { returnDocument: "after" },
    );
    acquired = lease?.owner === owner;
    if (!acquired) {
      // Losing the lease is not proof the other worker processed our update.
      // Retry after it finishes rather than silently dropping the fixture.
      shouldRetry = true;
      return;
    }
    // Long-running scoring passes must not lose their lease mid-rebuild.
    renewal = setInterval(() => {
      const timestamp = new Date();
      void leases.updateOne(
        { _id: "finished-match-scoring", owner },
        { $set: { expiresAt: new Date(timestamp.getTime() + LEASE_MS), updatedAt: timestamp } },
      ).catch((error) => console.error("[LowBlock] Failed to renew scoring lease:", error));
    }, RENEW_MS);
    renewal.unref?.();

    const { runScoreEngine } = await import("@/lib/scoring/scoreEngine");
    await runScoreEngine({ rebuildLeaderboards: true });
  } catch (error) {
    console.error("[LowBlock] Batched finished-match scoring failed:", error);
    shouldRetry = true;
  } finally {
    if (renewal) clearInterval(renewal);
    if (acquired) {
      try {
        const db = await getDb();
        await db.collection<any>("lowblockWorkerLeases").updateOne(
          { _id: "finished-match-scoring", owner },
          { $set: { expiresAt: new Date(0) } },
        );
      } catch (error) {
        console.error("[LowBlock] Failed to release scoring lease:", error);
      }
    }
    running = false;
    const trailing = requestedDuringRun;
    requestedDuringRun = false;
    if (shouldRetry) schedule(60_000);
    else if (trailing) schedule(BATCH_DELAY_MS);
  }
}
