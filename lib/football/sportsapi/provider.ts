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
import {
  getSportsApiDailyFixtures,
  getSportsApiTournamentSeasons,
  getSportsApiTournamentEvents,
  getSportsApiLiveMatches,
} from "./rest";
import { normalizeSportsApiMatch } from "./normalizer";
import { getSportsApiWsManager } from "./ws";
import { env } from "@/lib/env";
import { COMPETITION_MAPPINGS } from "../competitionMapping";
import { LEAGUES } from "../leagues";
import { rebuildRoundRecords } from "../roundLifecycle";
import { runScoreEngine, runLeaderboardEngine } from "@/lib/scoring/scoreEngine";
import { invalidateCompetitionCaches } from "@/lib/domain/cache";
import {
  startSportsApiBackgroundService,
  ensureSportsApiBackgroundService,
} from "./backgroundService";
import { providerDateKeys } from "../scheduleWindow";

// In-memory season cache to avoid redundant season requests
const seasonIdCache = new Map<number, { tournamentId?: number; id: number; name: string; year: string; cachedAt: number }>();

export class SportsApiFootballProvider implements FootballDataProvider {
  readonly name: ProviderName = "sportsapi";

  private async saveMatches(db: any, matches: CanonicalMatch[]): Promise<number> {
    if (!matches.length) return 0;

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

    // Also register teams into the central teams collection
    const teams = matches
      .flatMap((m) => [
        { ...m.homeTeam, leagueCode: m.leagueCode },
        { ...m.awayTeam, leagueCode: m.leagueCode },
      ])
      .filter((t) => t && t.id)
      .filter(
        (t, idx, arr) => arr.findIndex((x) => String(x.id) === String(t.id)) === idx,
      );

    if (teams.length > 0) {
      const teamOps = teams.map((team) => ({
        updateOne: {
          filter: {
            provider: this.name,
            providerTeamId: String(team.id),
          },
          update: {
            $set: {
              provider: this.name,
              providerTeamId: String(team.id),
              sourceName: team.name,
              crestUrl: team.logoUrl || (team as any).logo || (team.id ? `/api/team-image/${team.id}` : null),
              currentLeagueCodes: [team.leagueCode],
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      }));
      await db.collection("teams").bulkWrite(teamOps, { ordered: false });
    }

    return result.upsertedCount + result.modifiedCount;
  }

  async getDailyMatches(dates: string[]): Promise<CanonicalMatch[]> {
    const matchesMap = new Map<string, CanonicalMatch>();

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
              matchesMap.set(normalized.providerMatchId, normalized);
            }
          }
        }
      } catch (err) {
        console.error(`[SportsAPI] Failed to fetch fixtures for ${date}:`, err);
      }
    }

    return Array.from(matchesMap.values());
  }

  /**
   * Syncs upcoming and recent fixtures for all tournaments configured in LowBlock.
   * Caches seasons in DB and checks rate limits gracefully.
   */
  async syncAllTournaments(): Promise<{ total: number; requests: number }> {
    const db = await getDb();
    let total = 0;
    let requests = 0;
    const now = Date.now();
    let rateLimited = false;

    // Process tournaments sequentially to respect API rate limits and conserve quota
    for (const entry of COMPETITION_MAPPINGS) {
      if (rateLimited) break;

      const utId = entry.sportsApiUniqueTournamentId;
      if (!utId) continue;

      try {
        // 1. Resolve active season (memory -> DB -> API)
        let season = seasonIdCache.get(utId);
        if (!season || now - season.cachedAt > 14 * 24 * 60 * 60 * 1000) {
          const fromDb = await db.collection<any>("sportsApiSeasons").findOne({ tournamentId: utId });
          if (fromDb && now - (fromDb.cachedAt || 0) < 14 * 24 * 60 * 60 * 1000) {
            season = fromDb;
            seasonIdCache.set(utId, fromDb);
          } else {
            const seasonsRes: any = await getSportsApiTournamentSeasons(utId);
            requests++;
            if (seasonsRes.error?.message?.includes("429") || seasonsRes.error?.message?.includes("Rate limit")) {
              rateLimited = true;
              console.warn(`[SportsAPI] Rate limit reached while fetching seasons for ${entry.code}`);
              break;
            }
            const seasonsList = seasonsRes.seasons || seasonsRes.data || [];
            if (Array.isArray(seasonsList) && seasonsList.length > 0) {
              season = {
                tournamentId: utId,
                id: seasonsList[0].id,
                name: seasonsList[0].name,
                year: seasonsList[0].year,
                cachedAt: now,
              };
              seasonIdCache.set(utId, season);
              await db.collection("sportsApiSeasons").updateOne(
                { tournamentId: utId },
                { $set: season },
                { upsert: true },
              );
            }
          }
        }

        if (!season) continue;

        // 2. Fetch upcoming matches and recent matches
        const nextRes: any = await getSportsApiTournamentEvents(utId, season.id, "next", 0);
        requests++;
        if (nextRes.error?.message?.includes("429") || nextRes.error?.message?.includes("Rate limit")) {
          rateLimited = true;
          console.warn(`[SportsAPI] Rate limit reached while fetching upcoming events for ${entry.code}`);
          break;
        }

        const lastRes: any = await getSportsApiTournamentEvents(utId, season.id, "last", 0);
        requests++;
        if (lastRes.error?.message?.includes("429") || lastRes.error?.message?.includes("Rate limit")) {
          rateLimited = true;
          console.warn(`[SportsAPI] Rate limit reached while fetching last events for ${entry.code}`);
        }

        const nextEvents = nextRes.events || nextRes.data?.events || nextRes.data || [];
        const lastEvents = lastRes.events || lastRes.data?.events || lastRes.data || [];
        const allEvents = [
          ...(Array.isArray(nextEvents) ? nextEvents : []),
          ...(Array.isArray(lastEvents) ? lastEvents : []),
        ];

        const normalizedMatches: CanonicalMatch[] = [];
        for (const ev of allEvents) {
          const norm = normalizeSportsApiMatch(ev);
          if (norm) {
            norm.leagueCode = entry.code;
            norm.roundId = `${entry.code}:${norm.seasonStartYear}:${norm.matchday}`;
            normalizedMatches.push(norm);
          }
        }

        if (normalizedMatches.length > 0) {
          const saved = await this.saveMatches(db, normalizedMatches);
          total += saved;
        }

        // Update league metadata in DB
        const leagueConfig = LEAGUES.find((l) => l.code === entry.code);
        if (leagueConfig) {
          await db.collection("leagues").updateOne(
            { code: entry.code },
            {
              $set: {
                ...leagueConfig,
                seasonStartYear: parseInt(String(season.year).split("/")[0], 10) || new Date().getUTCFullYear(),
                provider: this.name,
                health: "OK",
                updatedAt: new Date(),
              },
              $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true },
          );
        }
      } catch (tErr: any) {
        if (tErr?.message?.includes("429") || tErr?.message?.includes("Rate limit")) {
          rateLimited = true;
          console.warn(`[SportsAPI] Rate limit reached while syncing tournament ${entry.code}`);
          break;
        }
        console.error(`[SportsAPI] Failed syncing tournament ${entry.code} (${utId}):`, tErr);
      }
    }

    return { total, requests };
  }

  async syncDate(dateKey: string): Promise<SyncDateResult> {
    const db = await getDb();
    const matches = await this.getDailyMatches([dateKey]);
    const total = await this.saveMatches(db, matches);

    await rebuildRoundRecords(db);
    const scoreEngine = await runScoreEngine();
    await runLeaderboardEngine();
    invalidateCompetitionCaches();

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
    const db = await getDb();
    let total = 0;
    let listRequests = 0;

    // 1. Sync daily window (yesterday, today, tomorrow) for live and real-time updates
    const dateKeys = providerDateKeys();

    const dailyMatches = await this.getDailyMatches(dateKeys);
    if (dailyMatches.length > 0) {
      const dailySaved = await this.saveMatches(db, dailyMatches);
      total += dailySaved;
    }
    listRequests += dateKeys.length;

    // 2. Optional tournament discovery. Disabled by default because it can
    // consume dozens of REST calls and is not safe on the Free plan.
    const tournamentSync = env.SPORTSAPI_TOURNAMENT_DISCOVERY_ENABLED
      ? await this.syncAllTournaments()
      : { total: 0, requests: 0 };
    total += tournamentSync.total;
    listRequests += tournamentSync.requests;

    // 3. Rebuild round lifecycle and recalculate scoring & leaderboards
    const rounds = await rebuildRoundRecords(db);
    const scoreEngine = await runScoreEngine();
    await runLeaderboardEngine();
    invalidateCompetitionCaches();

    // 4. Ensure automated real-time background WebSocket service is active
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
