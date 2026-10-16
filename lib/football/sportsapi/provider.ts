import { getDb } from "@/lib/db/mongo";
import type {
  FootballDataProvider,
  CanonicalMatch,
  SyncOptions,
  SyncResult,
  SyncDateResult,
  SyncDateOptions,
  ProviderName,
  ProviderRealtimeStatus,
} from "../types";
import {
  getSportsApiDailyFixtures,
  discoverSportsApiWeek,
  finalizeSportsApiWeek,
  getSportsApiTournamentSeasons,
  getSportsApiTournamentEvents,
} from "./rest";
import type { SportsApiDiscoveryManifest } from "./rest";
import { normalizeSportsApiMatch } from "./normalizer";
import { getSportsApiWsManager } from "./ws";
import { env } from "@/lib/env";
import { COMPETITION_MAPPINGS } from "../competitionMapping";
import { LEAGUES } from "../leagues";
import { rebuildRoundRecords } from "../roundLifecycle";
import { runScoreEngine } from "@/lib/scoring/scoreEngine";
import { invalidateCompetitionCaches } from "@/lib/domain/cache";
import {
  startSportsApiBackgroundService,
  ensureSportsApiBackgroundService,
} from "./backgroundService";
import { appDateKey, providerDateKeys } from "../scheduleWindow";
import { ensureCentralTeam } from "../centralTeams";

// In-memory season cache to avoid redundant season requests
const seasonIdCache = new Map<number, { tournamentId?: number; id: number; name: string; year: string; cachedAt: number }>();

export class SportsApiFootballProvider implements FootballDataProvider {
  readonly name: ProviderName = "sportsapi";

  private async refreshDailyH2H(db: any, dateKeys: string[]) {
    if (!env.H2H_ENABLED) return;
    const { ensureCurrentH2HLeagues } = await import("@/lib/domain/h2h");
    const today = appDateKey();
    for (const sourceDate of dateKeys.filter((dateKey) => dateKey >= today)) {
      await ensureCurrentH2HLeagues(db, { sourceDate, batchIndex: 0, batchSize: 1000 });
    }
  }

  private async syncTargetedTournamentFallback(
    dateKeys: string[],
    dailyMatches: CanonicalMatch[],
    db: any,
  ): Promise<{ total: number; requests: number; codes: string[] }> {
    const configuredCodes = env.SPORTSAPI_TARGETED_TOURNAMENT_FALLBACK_CODES
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    if (!configuredCodes.length) return { total: 0, requests: 0, codes: [] };

    let total = 0;
    let requests = 0;
    const recoveredCodes: string[] = [];

    for (const code of configuredCodes) {
      const entry = COMPETITION_MAPPINGS.find((item) => item.code === code);
      if (!entry) {
        console.warn(`[SportsAPI] Ignoring unknown targeted fallback code: ${code}`);
        continue;
      }

      const missingDates = dateKeys.filter((dateKey) =>
        !dailyMatches.some(
          (match) => match.leagueCode === code && appDateKey(new Date(match.kickoffAt)) === dateKey,
        ),
      );
      if (!missingDates.length) continue;

      try {
        const seasonsRes: any = await getSportsApiTournamentSeasons(
          entry.sportsApiUniqueTournamentId,
        );
        requests++;
        const seasons = seasonsRes.seasons || seasonsRes.data || [];
        const season = Array.isArray(seasons) ? seasons[0] : null;
        if (!season?.id) {
          console.warn(`[SportsAPI] No active season for targeted fallback ${code}`);
          continue;
        }

        const [nextRes, lastRes] = await Promise.all([
          getSportsApiTournamentEvents(
            entry.sportsApiUniqueTournamentId,
            season.id,
            "next",
            0,
          ),
          getSportsApiTournamentEvents(
            entry.sportsApiUniqueTournamentId,
            season.id,
            "last",
            0,
          ),
        ]);
        requests += 2;

        const nextEvents = (nextRes as any).events || (nextRes as any).data?.events || (nextRes as any).data || [];
        const lastEvents = (lastRes as any).events || (lastRes as any).data?.events || (lastRes as any).data || [];
        const recovered = [...nextEvents, ...lastEvents]
          .map((event) => normalizeSportsApiMatch(event))
          .filter((match): match is CanonicalMatch => {
            if (!match || match.leagueCode !== code) return false;
            return missingDates.includes(appDateKey(new Date(match.kickoffAt)));
          });

        if (recovered.length) {
          total += await this.saveMatches(db, recovered);
          recoveredCodes.push(code);
        }
      } catch (error) {
        console.error(`[SportsAPI] Targeted tournament fallback failed for ${code}:`, error);
      }
    }

    return { total, requests, codes: recoveredCodes };
  }

  private async saveMatches(db: any, matches: CanonicalMatch[]): Promise<number> {
    if (!matches.length) return 0;

    const centralIds = new Map<string, string>();
    await Promise.all(matches.flatMap((match) => [match.homeTeam, match.awayTeam]).map(async (team) => {
      const providerTeamId = String(team.id);
      const centralId = await ensureCentralTeam({ provider: "sportsapi", providerTeamId, sourceName: team.name, logoUrl: team.logoUrl });
      centralIds.set(providerTeamId, centralId);
    }));

    const ops = matches.map((match) => {
      const { createdAt, _id, ...matchData } = match as any;
      matchData.homeTeam = { ...matchData.homeTeam, centralTeamId: centralIds.get(String(match.homeTeam.id)) };
      matchData.awayTeam = { ...matchData.awayTeam, centralTeamId: centralIds.get(String(match.awayTeam.id)) };
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
    const result = await this.collectDailyMatches(dates);
    return result.matches;
  }

  private async collectDailyMatches(dates: string[]): Promise<{
    matches: CanonicalMatch[];
    failedDates: string[];
  }> {
    const matchesMap = new Map<string, CanonicalMatch>();
    const failedDates: string[] = [];

    for (const date of dates) {
      try {
        const response = await getSportsApiDailyFixtures(date);
        if (response.success === false || response.error) {
          failedDates.push(date);
          continue;
        }
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
        failedDates.push(date);
        console.error(`[SportsAPI] Failed to fetch fixtures for ${date}:`, err);
      }
    }

    return { matches: Array.from(matchesMap.values()), failedDates };
  }

  async syncWeekDates(dateKeys: string[]) {
    const db = await getDb();
    const discovery = await discoverSportsApiWeek(dateKeys, { attempts: 1, reuseComplete: true });
    if (!discovery.complete) {
      throw new Error(`SportsAPI weekly discovery incomplete: ${discovery.manifests.filter((item) => item.status !== "COMPLETE").map((item) => item.dateString).join(", ")}`);
    }
    const matches = discovery.events
      .map((event) => normalizeSportsApiMatch(event))
      .filter((match): match is CanonicalMatch => Boolean(match));
    const total = await this.saveMatches(db, matches);
    return { total, matches, discovery };
  }

  async finalizeWeekDates(dateKeys: string[]) {
    const db = await getDb();
    const discovery = await finalizeSportsApiWeek(dateKeys);
    const events = discovery.manifests.flatMap((manifest) => (manifest as SportsApiDiscoveryManifest & { data?: { events?: any[] } }).data?.events ?? []);
    const matches = events
      .map((event: any) => normalizeSportsApiMatch(event))
      .filter((match): match is CanonicalMatch => Boolean(match));
    const total = await this.saveMatches(db, matches);
    await this.refreshDailyH2H(db, dateKeys);
    return { total, matches, discovery };
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

  async syncDate(
    dateKey: string,
    options?: SyncDateOptions,
  ): Promise<SyncDateResult> {
    const db = await getDb();
    const matches = await this.getDailyMatches([dateKey]);
    const dailyTotal = await this.saveMatches(db, matches);
    const fallback = await this.syncTargetedTournamentFallback([dateKey], matches, db);
    const total = dailyTotal + fallback.total;
    await this.refreshDailyH2H(db, [dateKey]);

    await rebuildRoundRecords(db);
    const scoreEngine = options?.deferScoring
      ? {
          scores: 0,
          leaderboards: 0,
          matches: 0,
          roundWinners: 0,
          awards: null,
          deferred: true,
        }
      : { ...(await runScoreEngine()), deferred: false };
    invalidateCompetitionCaches();

    return {
      total,
      listRequests: 1 + fallback.requests,
      scoreEngine: {
        scores: scoreEngine.scores,
        leaderboards: scoreEngine.leaderboards,
        matches: scoreEngine.matches,
        roundWinners: scoreEngine.roundWinners,
        awards: scoreEngine.awards,
        deferred: scoreEngine.deferred,
      },
    };
  }

  /**
   * Small second pass used after the main nightly sync. It refreshes only
   * yesterday, so final scores get another provider read without repeating
   * weekly discovery or spending another large quota batch.
   */
  async syncRecentResults(): Promise<SyncDateResult> {
    const db = await getDb();
    const dateKey = providerDateKeys()[0];
    const matches = await this.getDailyMatches([dateKey]);
    const total = await this.saveMatches(db, matches);
    invalidateCompetitionCaches();

    try {
      await db.collection("syncRuns").insertOne({
        provider: this.name,
        mode: "recent-results-recovery",
        startedAt: new Date(),
        finishedAt: new Date(),
        status: "OK",
        listRequests: 1,
        detailRequests: 0,
        fixturesUpdated: total,
        scoring: "DEFERRED_TO_LEADERBOARD_CRON",
      });
    } catch (recordingError) {
      console.error("[SportsAPI] Failed to record recovery run:", recordingError);
    }

    return {
      total,
      listRequests: 1,
      scoreEngine: {
        scores: 0,
        leaderboards: 0,
        matches: 0,
        deferred: true,
      },
    };
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const db = await getDb();
    const startedAt = new Date();
    let total = 0;
    let listRequests = 0;

    // Refresh exactly yesterday, today, and tomorrow through REST. The daily
    // fixture helper caches each date, so cron and Telegram sync_now share the
    // same bounded request path instead of multiplying quota usage.
    const dateKeys = providerDateKeys();
    const dailyResult = await this.collectDailyMatches(dateKeys);
    const dailyMatches = dailyResult.matches;
    if (dailyMatches.length > 0) total += await this.saveMatches(db, dailyMatches);
    await this.refreshDailyH2H(db, dateKeys);
    // One /schedule request per date, at most three provider calls per run.
    listRequests += dateKeys.length;

    // 2. Rebuild round lifecycle and recalculate scoring & leaderboards. The
    // score engine already materializes leaderboards, so do not run it twice.
    const rounds = options?.deferScoring ? 0 : await rebuildRoundRecords(db);
    const scoreEngine = options?.deferScoring
      ? {
          scores: 0,
          leaderboards: 0,
          matches: 0,
          roundWinners: 0,
          awards: null,
          deferred: true,
        }
      : await runScoreEngine();
    invalidateCompetitionCaches();

    try {
      await db.collection("syncRuns").insertOne({
        provider: this.name,
        mode: "daily-window-rest",
        startedAt,
        finishedAt: new Date(),
        status:
          dailyResult.failedDates.length === 0
            ? "OK"
            : dailyResult.failedDates.length === dateKeys.length
              ? "FAILED"
              : "PARTIAL",
        listRequests,
        detailRequests: 0,
        fixturesUpdated: total,
        roundsUpdated: rounds,
        failedDates: dailyResult.failedDates,
        scoreEngine,
        scoring: options?.deferScoring
          ? "DEFERRED_TO_LEADERBOARD_CRON"
          : "COMPLETED",
      });
    } catch (recordingError) {
      console.error("[SportsAPI] Failed to record sync run:", recordingError);
    }

    // 3. Ensure automated real-time background WebSocket service is active
    ensureSportsApiBackgroundService();

    return {
      total,
      listRequests,
      detailRequests: 0,
      rounds,
      failedDates: dailyResult.failedDates,
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
