import { getDb } from "@/lib/db/mongo";
import type { LiveMatchSnapshot } from "./matchMonitor";
import { getMatchMonitorService } from "./matchMonitor";
import { ensureSportsApiBackgroundService } from "./backgroundService";

/**
 * Retrieves the latest match live details (score, incidents, stats, lineups, odds)
 * exclusively from MongoDB and the real-time WebSocket connection.
 *
 * ZERO REST API requests are made, protecting your API quota from being consumed.
 */
export async function getOrFetchMatchDetails(
  matchId: string,
  _forceRefresh = false,
): Promise<LiveMatchSnapshot | null> {
  // 1. Ensure the automated background WebSocket daemon is active and listening
  ensureSportsApiBackgroundService();

  const monitor = getMatchMonitorService();

  // 2. Ensure real-time WebSocket channels for this match are actively subscribed
  monitor.subscribeMatchChannels(matchId);

  // 3. Check in-memory snapshot if it already has rich data from WebSocket
  const inMemory = monitor.getSnapshot(matchId);
  const inMemoryHasContent = Boolean(
    inMemory.lineups?.home?.players?.length ||
    inMemory.lineups?.away?.players?.length ||
    inMemory.stats?.length > 0 ||
    inMemory.incidents?.length > 0,
  );

  if (inMemoryHasContent) {
    return inMemory;
  }

  // 4. Load from MongoDB matchDetails collection
  const fromDb = await monitor.loadSnapshotFromDb(matchId);
  const dbHasContent = Boolean(
    fromDb.lineups?.home?.players?.length ||
    fromDb.lineups?.away?.players?.length ||
    fromDb.stats?.length > 0 ||
    fromDb.incidents?.length > 0,
  );

  if (dbHasContent) {
    return fromDb;
  }

  // 5. Fallback to basic match record from matches collection if matchDetails is not yet populated
  const db = await getDb();
  const matchRecord = await db.collection<any>("matches").findOne({
    provider: { $in: ["sportsapi", "football-api"] },
    providerMatchId: matchId,
  });

  if (matchRecord) {
    const fallbackSnapshot: LiveMatchSnapshot = {
      matchId,
      score: {
        home: matchRecord.homeGoals ?? fromDb.score.home ?? null,
        away: matchRecord.awayGoals ?? fromDb.score.away ?? null,
        status: matchRecord.status || fromDb.score.status || "SCHEDULED",
        elapsed: matchRecord.elapsed ?? fromDb.score.elapsed ?? null,
      },
      incidents: fromDb.incidents || [],
      stats: fromDb.stats || [],
      lineups: fromDb.lineups || null,
      odds: fromDb.odds || [],
      lastUpdateAt: Date.now(),
    };
    return fallbackSnapshot;
  }

  return fromDb;
}
