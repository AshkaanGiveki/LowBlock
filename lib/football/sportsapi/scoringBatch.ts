import { getDb } from "@/lib/db/mongo";

// One rebuild for a burst of finalized matches, never one rebuild per match.
// A Mongo lease prevents multiple application instances from rebuilding at once.
const BATCH_DELAY_MS = 30_000;
const LEASE_MS = 10 * 60_000;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export function queueFinishedMatchScoring(): void {
  if (timer || running) return;
  timer = setTimeout(() => {
    timer = null;
    void flushFinishedMatchScoring();
  }, BATCH_DELAY_MS);
  timer.unref?.();
}

export async function flushFinishedMatchScoring(): Promise<void> {
  if (running) return;
  running = true;
  const owner = `${process.pid}:${Math.random().toString(36).slice(2)}`;
  let acquired = false;
  try {
    const db = await getDb();
    const now = new Date();
    const lease = await db.collection("lowblockWorkerLeases").findOneAndUpdate(
      {
        _id: "finished-match-scoring",
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      { $set: { owner, expiresAt: new Date(now.getTime() + LEASE_MS), updatedAt: now } },
      { returnDocument: "after" },
    );
    acquired = lease?.owner === owner;
    if (!acquired) return;
    const { runScoreEngine } = await import("@/lib/scoring/scoreEngine");
    await runScoreEngine({ rebuildLeaderboards: true });
  } catch (error) {
    console.error("[LowBlock] Batched finished-match scoring failed:", error);
    queueFinishedMatchScoring();
  } finally {
    if (acquired) {
      try {
        const db = await getDb();
        await db.collection("lowblockWorkerLeases").updateOne(
          { _id: "finished-match-scoring", owner },
          { $set: { expiresAt: new Date(0) } },
        );
      } catch (error) {
        console.error("[LowBlock] Failed to release scoring lease:", error);
      }
    }
    running = false;
  }
}
