import { getDb } from "@/lib/db/mongo";
import type {
  FootballDataProvider,
  CanonicalMatch,
  SyncOptions,
  SyncResult,
  SyncDateResult,
  ProviderName,
  ProviderRealtimeStatus,
} from "../types";
import { getSportsApiDailyFixtures } from "./rest";
import { normalizeSportsApiMatch } from "./normalizer";
import { getSportsApiWsManager } from "./ws";
import { rebuildRoundRecords } from "../roundLifecycle";
import { runScoreEngine } from "@/lib/scoring/scoreEngine";
import {
  startSportsApiBackgroundService,
  ensureSportsApiBackgroundService,
} from "./backgroundService";

export class SportsApiFootballProvider implements FootballDataProvider {
  readonly name: ProviderName = "sportsapi";

  async getDailyMatches(dates: string[]): Promise<CanonicalMatch[]> {
    const matches: CanonicalMatch[] = [];
    for (const date of dates) {
      try {
        const response = await getSportsApiDailyFixtures(date);
        const resAny = response as any;
        const rawList =
          resAny.events ||
          resAny.data ||
          (Array.isArray(response) ? response : null) ||
          [];

        if (Array.isArray(rawList)) {
          for (const item of rawList) {
            const normalized = normalizeSportsApiMatch(item);
            if (normalized) {
              matches.push(normalized);
            }
          }
        }
      } catch (err) {
        console.error(`[SportsAPI] Failed to fetch schedule for ${date}:`, err);
      }
    }
    return matches;
  }

  async syncDate(dateKey: string): Promise<SyncDateResult> {
    const db = await getDb();
    let total = 0;
    const matches = await this.getDailyMatches([dateKey]);

    if (matches.length > 0) {
      const ops = matches.map((match) => {
        const { createdAt, _id, ...matchData } = match as any;
        return {
          updateOne: {
            filter: {
              provider: this.name,
              providerMatchId: match.providerMatchId,
            },
            update: {
              $set: {
                ...matchData,
                updatedAt: new Date(),
              },
              $setOnInsert: { createdAt: createdAt || new Date() },
            },
            upsert: true,
          },
        };
      });

      const result = await db.collection("matches").bulkWrite(ops, { ordered: false });
      total = result.upsertedCount + result.modifiedCount;
    }

    await rebuildRoundRecords(db);
    const scoreEngine = await runScoreEngine();

    return {
      total,
      listRequests: 1,
      scoreEngine: {
        scores: scoreEngine.scores,
        leaderboards: scoreEngine.leaderboards,
        matches: scoreEngine.matches,
        roundWinners: scoreEngine.roundWinners,
        awards: scoreEngine.awards,
      },
    };
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const dateKeys = [
      yesterday.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10),
      tomorrow.toISOString().slice(0, 10),
    ];

    let total = 0;
    let listRequests = 0;

    for (const key of dateKeys) {
      const res = await this.syncDate(key);
      total += res.total;
      listRequests += res.listRequests;
    }

    const db = await getDb();
    const rounds = await rebuildRoundRecords(db);
    const scoreEngine = await runScoreEngine();

    ensureSportsApiBackgroundService();

    return {
      total,
      listRequests,
      detailRequests: 0,
      rounds,
      scoreEngine: {
        scores: scoreEngine.scores,
        leaderboards: scoreEngine.leaderboards,
        matches: scoreEngine.matches,
        roundWinners: scoreEngine.roundWinners,
        awards: scoreEngine.awards,
      },
    };
  }

  startRealtime(): void {
    startSportsApiBackgroundService();
  }

  stopRealtime(): void {
    const ws = getSportsApiWsManager();
    ws.disconnect();
  }

  getRealtimeStatus(): ProviderRealtimeStatus {
    const ws = getSportsApiWsManager();
    return ws.getStatus();
  }
}
