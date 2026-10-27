import type { Db } from "mongodb";

/**
 * Matchday REST polling is intentionally disabled. The server-owned worker
 * uses the bounded daily schedule window and SportsAPI WebSocket updates;
 * Legacy matchday polling is disabled so it cannot consume the free quota.
 */
export async function scheduleMatchdayPolling(_db: Db, _dateKey: string) {
  return { scheduled: 0, reason: "local-worker-only" as const };
}

export async function pollMatchday(_dateKey: string) {
  return { synced: false, reason: "local-worker-only" as const };
}
