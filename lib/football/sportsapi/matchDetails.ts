import { getMatchMonitorService } from "./matchMonitor";
import { ensureSportsApiBackgroundService } from "./backgroundService";
import type { LiveMatchSnapshot } from "./matchMonitor";

/**
 * Returns the current SportsApi snapshot for a match.
 *
 * SportsApi REST is intentionally not used here. Fixture-list discovery is
 * the only REST workflow; scores, incidents, stats, lineups, odds, and replay
 * state arrive through the WebSocket and are persisted by MatchMonitorService.
 */
export async function getOrFetchMatchDetails(
  matchId: string,
  _forceRefresh = false,
): Promise<LiveMatchSnapshot | null> {
  ensureSportsApiBackgroundService();

  const monitor = getMatchMonitorService();
  monitor.subscribeMatchChannels(matchId);

  const inMemory = monitor.getSnapshot(matchId);
  const hasRichInMemoryData = Boolean(
    inMemory.score.home !== null &&
      inMemory.score.status !== "SCHEDULED" &&
      (inMemory.lineups?.home?.players?.length ||
        inMemory.lineups?.away?.players?.length ||
        inMemory.stats.length > 0 ||
        inMemory.incidents.length > 0),
  );
  if (hasRichInMemoryData) return inMemory;

  // MatchMonitorService hydrates this snapshot from matchDetails and the
  // canonical matches row. Any later WebSocket event updates this snapshot,
  // persists it, and is forwarded to the drawer through SSE.
  return monitor.loadSnapshotFromDb(matchId);
}
