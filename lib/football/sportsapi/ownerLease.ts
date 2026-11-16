import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/mongo";
import { getMatchMonitorService } from "./matchMonitor";
import { startSportsApiBackgroundService, stopSportsApiBackgroundService } from "./backgroundService";

const OWNER_ID = randomUUID();
const LEASE_MS = 90_000;
const RENEW_MS = 25_000;
let renewal: ReturnType<typeof setInterval> | null = null;
let active = false;
let checking = false;

/**
 * Mongo-backed single-owner lease. Without a valid lease the process must not
 * hold an upstream SportsAPI socket, even if another worker is running.
 */
export async function checkLiveIngestionOwnership(): Promise<boolean> {
  if (checking) return active;
  checking = true;
  try {
    const db = await getDb();
    const leases = db.collection<any>("liveIngestionLeases");
    const now = new Date();
    // Create an inert lease once, then atomically acquire or renew.
    await leases.updateOne(
      { _id: "sportsapi-upstream" },
      { $setOnInsert: { owner: "", expiresAt: new Date(0) } },
      { upsert: true },
    );
    const result = await leases.findOneAndUpdate(
      {
        _id: "sportsapi-upstream",
        $or: [{ owner: OWNER_ID }, { expiresAt: { $lte: now } }],
      },
      { $set: { owner: OWNER_ID, expiresAt: new Date(now.getTime() + LEASE_MS), updatedAt: now } },
      { returnDocument: "after" },
    );
    if (result?.owner === OWNER_ID) {
      if (!active) {
        process.env.LOWBLOCK_LIVE_INGESTION_WORKER = "true";
        active = true;
        getMatchMonitorService().startIngestion();
        startSportsApiBackgroundService();
        console.info("[LowBlock] SportsAPI live-ingestion lease acquired");
      }
      return true;
    }
  } catch (error) {
    console.warn("[LowBlock] SportsAPI ingestion ownership cannot be verified:", error);
  } finally {
    checking = false;
  }
  // Fail closed: do not keep upstream connections after lease loss/errors.
  if (active) {
    active = false;
    process.env.LOWBLOCK_LIVE_INGESTION_WORKER = "false";
    stopSportsApiBackgroundService();
    console.warn("[LowBlock] SportsAPI ingestion lease lost: upstream disconnected");
  }
  return false;
}

export async function startLiveIngestionOwnership(): Promise<void> {
  // A worker without its provider credentials/config must never claim ownership.
  if (process.env.SPORTSAPI_WS_ENABLED === "false" || !process.env.SPORTSAPI_API_KEY) return;
  if (renewal) return;
  await checkLiveIngestionOwnership();
  renewal = setInterval(() => { void checkLiveIngestionOwnership(); }, RENEW_MS);
  renewal.unref?.();
}

export async function stopLiveIngestionOwnership(): Promise<void> {
  if (renewal) clearInterval(renewal);
  renewal = null;
  active = false;
  process.env.LOWBLOCK_LIVE_INGESTION_WORKER = "false";
  stopSportsApiBackgroundService();
  try {
    const db = await getDb();
    await db.collection<any>("liveIngestionLeases").updateOne(
      { _id: "sportsapi-upstream", owner: OWNER_ID },
      { $set: { expiresAt: new Date(0) } },
    );
  } catch {}
}
