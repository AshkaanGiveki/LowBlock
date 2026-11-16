import { getSportsApiWsManager, isSportsApiRealtimeEnabled } from "./ws";
import { getDb } from "@/lib/db/mongo";

let isStarted = false;
let refreshTimer: NodeJS.Timeout | null = null;
let syncInFlight: Promise<void> | null = null;
const managedChannels = new Set<string>();
const MAX_TRACKED_MATCHES = 32;
const LIVE_WINDOW_BEFORE_MS = 3 * 60 * 60_000;
const LIVE_WINDOW_AFTER_MS = 5 * 60 * 60_000;

export function isSportsApiBackgroundServiceRunning(): boolean {
  return isStarted;
}

/**
 * Syncs subscriptions to SportsAPI WebSocket channels for all active,
 * upcoming, and recent matches stored in MongoDB.
 *
 * Exclusively uses WebSocket streaming channels. ZERO REST quota is used.
 */
async function performActiveMatchSubscriptionSync(): Promise<void> {
  if (!isSportsApiRealtimeEnabled()) return;
  try {
    const db = await getDb();
    const now = Date.now();
    const fromTime = new Date(now - LIVE_WINDOW_AFTER_MS);
    const toTime = new Date(now + LIVE_WINDOW_BEFORE_MS);

    const matches = await db
      .collection<any>("matches")
      .find({
        provider: "sportsapi",
        kickoffAt: { $gte: fromTime, $lte: toTime },
        status: { $in: ["LIVE", "IN_PLAY", "PAUSED", "SUSPENDED", "SCHEDULED"] },
      })
      .project({ providerMatchId: 1, status: 1, kickoffAt: 1 })
      .sort({ kickoffAt: 1 })
      .limit(MAX_TRACKED_MATCHES)
      .toArray();

    if (!isSportsApiRealtimeEnabled()) return;
    const ws = getSportsApiWsManager();

    // Ensure connection is active
    ws.connect();
    ws.subscribeToChannel("live-scores");
    ws.subscribeToChannel("live-scores:football");

    const desired = new Set<string>();
    for (const m of matches) {
      const matchId = String(m.providerMatchId ?? "");
      if (!matchId) continue;
      desired.add(`match:${matchId}`);
      desired.add(`match:${matchId}:incidents`);
      desired.add(`match:${matchId}:stats`);
      desired.add(`match:${matchId}:lineups`);
      // No odds channels. LowBlock is a points-based prediction game.
    }
    for (const channel of managedChannels) {
      if (!desired.has(channel)) {
        ws.unsubscribeFromChannel(channel);
        managedChannels.delete(channel);
      }
    }
    for (const channel of desired) {
      if (!managedChannels.has(channel)) {
        ws.subscribeToChannel(channel);
        managedChannels.add(channel);
      }
    }

  } catch (err) {
    console.error("[SportsApiBackground] Failed to sync match subscriptions from DB:", err);
  }
}

export function syncActiveMatchesSubscriptions(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = performActiveMatchSubscriptionSync().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

/**
 * Starts the automated SportsAPI WebSocket background synchronization service.
 * Connects the WebSocket, subscribes to active match channels, and sets up
 * periodic refresh loops.
 */
export function startSportsApiBackgroundService(): void {
  // Vercel functions are short-lived and may be instantiated concurrently.
  // A process-local interval/WebSocket here creates one DB subscription scan
  // per warm instance and amplifies Mongo pressure during live matches.
  // Browsers never subscribe to SportsAPI. Only this dedicated worker does.
  if (!isSportsApiRealtimeEnabled()) {
    return;
  }
  if (process.env.VERCEL === "1") return;
  if (isStarted) return;
  isStarted = true;

  console.log("[SportsApiBackground] Starting automated background sync service (pure WebSocket)...");

  const ws = getSportsApiWsManager();

  // 1. Connect WebSocket
  ws.connect();
  ws.subscribeToChannel("live-scores");
  ws.subscribeToChannel("live-scores:football");

  // 2. Discover and subscribe to all active/today matches in DB
  syncActiveMatchesSubscriptions().catch((err) =>
    console.error("[SportsApiBackground] Initial syncActiveMatchesSubscriptions failed:", err),
  );

  // 3. Periodic refresh of active match subscriptions every 60 seconds
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    syncActiveMatchesSubscriptions().catch((err) =>
      console.error("[SportsApiBackground] syncSubscriptions error:", err),
    );
  }, 60_000);
  refreshTimer.unref?.();
}

/**
 * Safe initializer helper that guarantees the background service is running.
 */
export function ensureSportsApiBackgroundService(): void {
  if (!isStarted) {
    startSportsApiBackgroundService();
  }
}

/**
 * Disconnect immediately on lease loss; keep listeners so the same worker
 * can safely reconnect if it later regains ownership.
 */
export function stopSportsApiBackgroundService(): void {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  const ws = getSportsApiWsManager();
  for (const channel of managedChannels) ws.unsubscribeFromChannel(channel);
  managedChannels.clear();
  ws.unsubscribeFromChannel("live-scores");
  ws.unsubscribeFromChannel("live-scores:football");
  ws.disconnect();
  isStarted = false;
}
