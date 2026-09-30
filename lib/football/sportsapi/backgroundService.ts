import { getSportsApiWsManager } from "./ws";
import { getMatchMonitorService } from "./matchMonitor";
import { getDb } from "@/lib/db/mongo";
import { getOrFetchMatchDetails } from "./matchDetails";

let isStarted = false;
let refreshTimer: NodeJS.Timeout | null = null;
let backfillTimer: NodeJS.Timeout | null = null;

export function isSportsApiBackgroundServiceRunning(): boolean {
  return isStarted;
}

/**
 * Syncs subscriptions to SportsAPI WebSocket channels for all active,
 * upcoming, and recent matches stored in MongoDB.
 */
export async function syncActiveMatchesSubscriptions(): Promise<void> {
  try {
    const db = await getDb();
    const now = Date.now();
    const fromTime = new Date(now - 12 * 60 * 60 * 1000); // 12 hours ago
    const toTime = new Date(now + 36 * 60 * 60 * 1000); // 36 hours ahead

    const matches = await db
      .collection<any>("matches")
      .find({
        provider: "sportsapi",
        $or: [
          { kickoffAt: { $gte: fromTime, $lte: toTime } },
          { status: { $in: ["LIVE", "IN_PLAY", "PAUSED", "SUSPENDED", "SCHEDULED"] } },
        ],
      })
      .project({ providerMatchId: 1, status: 1, homeTeam: 1, awayTeam: 1, kickoffAt: 1 })
      .toArray();

    const monitor = getMatchMonitorService();
    const ws = getSportsApiWsManager();

    for (const m of matches) {
      const matchId = String(m.providerMatchId);
      if (!matchId) continue;

      // Subscribe to all real-time channels for this match
      ws.subscribeToChannel(`match:${matchId}`);
      ws.subscribeToChannel(`match:${matchId}:incidents`);
      ws.subscribeToChannel(`match:${matchId}:stats`);
      ws.subscribeToChannel(`match:${matchId}:lineups`);
      ws.subscribeToChannel(`match:${matchId}:odds`);

      // Ensure snapshot exists and is seeded from DB
      await monitor.loadSnapshotFromDb(matchId);
    }
  } catch (err) {
    console.error("[SportsApiBackground] Failed to sync match subscriptions from DB:", err);
  }
}

/**
 * Periodically verifies that matches starting soon or live have their
 * lineups and statistics cached, backfilling any missing data.
 */
async function backfillMissingDetails(): Promise<void> {
  try {
    const db = await getDb();
    const now = Date.now();
    const fromTime = new Date(now - 24 * 60 * 60 * 1000);
    const toTime = new Date(now + 12 * 60 * 60 * 1000);

    const matches = await db
      .collection<any>("matches")
      .find({
        provider: "sportsapi",
        kickoffAt: { $gte: fromTime, $lte: toTime },
      })
      .toArray();

    for (const m of matches) {
      const matchId = String(m.providerMatchId);
      if (!matchId) continue;

      const details = await db.collection<any>("matchDetails").findOne({ matchId });
      const hasContent = Boolean(
        details?.lineups?.home?.players?.length ||
        details?.stats?.length > 0 ||
        details?.incidents?.length > 0,
      );

      const isFinished = m.status === "FINISHED" || details?.score?.status === "FINISHED";
      const kickoffMs = new Date(m.kickoffAt).getTime();
      const isSoon = kickoffMs - now < 3600_000; // < 1 hr to kickoff

      // Only attempt to backfill if the match is finished or starting soon and content is missing
      if ((isFinished || isSoon) && !hasContent) {
        // Safe delay to stay well within API limits
        await new Promise((r) => setTimeout(r, 2000));
        await getOrFetchMatchDetails(matchId, true);
      }
    }
  } catch (err) {
    console.error("[SportsApiBackground] Error in backfillMissingDetails:", err);
  }
}

/**
 * Starts the automated SportsAPI WebSocket background synchronization service.
 * Connects the WebSocket, subscribes to active match channels, and sets up
 * periodic refresh loops.
 */
export function startSportsApiBackgroundService(): void {
  if (isStarted) return;
  isStarted = true;

  console.log("[SportsApiBackground] Starting automated background sync service...");

  const ws = getSportsApiWsManager();
  const monitor = getMatchMonitorService();

  // 1. Connect WebSocket
  ws.connect();
  ws.subscribeToChannel("live-scores");

  // 2. Discover and subscribe to all active/today matches in DB
  syncActiveMatchesSubscriptions().catch((err) =>
    console.error("[SportsApiBackground] Initial syncActiveMatchesSubscriptions failed:", err),
  );

  // 3. Periodic refresh of active match subscriptions every 3 minutes
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    syncActiveMatchesSubscriptions().catch((err) =>
      console.error("[SportsApiBackground] syncSubscriptions error:", err),
    );
  }, 180_000);

  // 4. Background backfill check every 5 minutes
  if (backfillTimer) clearInterval(backfillTimer);
  backfillTimer = setInterval(() => {
    backfillMissingDetails().catch((err) =>
      console.error("[SportsApiBackground] backfill error:", err),
    );
  }, 300_000);
}

/**
 * Safe initializer helper that guarantees the background service is running.
 */
export function ensureSportsApiBackgroundService(): void {
  if (!isStarted) {
    startSportsApiBackgroundService();
  }
}
