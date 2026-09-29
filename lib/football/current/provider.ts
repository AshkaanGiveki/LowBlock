import type {
  FootballDataProvider,
  CanonicalMatch,
  SyncOptions,
  SyncResult,
  SyncDateResult,
  ProviderName,
} from "../types";
import { syncFootballApi, syncFootballApiDate } from "../api-sports/sync";

export class CurrentFootballProvider implements FootballDataProvider {
  readonly name: ProviderName = "football-api";

  async getDailyMatches(dates: string[]): Promise<CanonicalMatch[]> {
    // The current provider writes directly to `matches` in a different format.
    // In this abstraction layer, we don't strictly need to return CanonicalMatch arrays 
    // for the legacy system because it uses its existing DB records directly.
    return [];
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    // Call the exact legacy sync function
    const result = await syncFootballApi();
    return {
      total: result.total,
      listRequests: result.listRequests,
      detailRequests: result.detailRequests,
      rounds: result.rounds,
      insights: result.insights,
      scoreEngine: result.scoreEngine,
      leaderboardEngine: result.leaderboardEngine,
    };
  }

  async syncDate(dateKey: string): Promise<SyncDateResult> {
    // Call the exact legacy sync date function
    const result = await syncFootballApiDate(dateKey);
    return {
      total: result.total,
      listRequests: result.listRequests,
      scoreEngine: result.scoreEngine,
      leaderboardEngine: result.leaderboardEngine,
    };
  }
}
