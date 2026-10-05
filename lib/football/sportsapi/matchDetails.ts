import { getDb } from "@/lib/db/mongo";
import type {
  LiveMatchSnapshot,
  LiveIncident,
  LiveStatGroup,
  LiveLineups,
  LiveOddsMarket,
} from "./matchMonitor";
import { getMatchMonitorService } from "./matchMonitor";
import { ensureSportsApiBackgroundService } from "./backgroundService";
import { fetchSportsApi } from "./rest";
import { runScoreEngine } from "@/lib/scoring/scoreEngine";
import { env } from "@/lib/env";

const inFlight = new Map<string, Promise<LiveMatchSnapshot | null>>();

function personName(value: any): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  return value.name || value.shortName || value.player?.name || value.player?.shortName || null;
}

function extractAssistName(incident: any): string | null {
  return personName(
    incident.assist1 ??
      incident.assist2 ??
      incident.assist ??
      incident.assistant ??
      incident.assistPlayer ??
      incident.playerAssist ??
      incident.incident?.assist1 ??
      incident.incident?.assist,
  );
}

function parseCanonicalStatus(rawStatus: any): "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "VOID" | "SUSPENDED" {
  if (!rawStatus) return "SCHEDULED";
  const type = String(rawStatus.type || "").toLowerCase();
  const desc = String(rawStatus.description || "").toUpperCase();
  const code = rawStatus.code;

  if (type === "finished" || desc === "ENDED" || desc === "FT" || desc === "AET" || desc === "AFTER ET" || desc === "AWARDED" || desc === "WO" || code === 100) {
    return "FINISHED";
  }
  if (type === "inprogress" || desc === "INPROGRESS" || desc === "1ST HALF" || desc === "2ND HALF" || desc === "HALFTIME" || code === 6 || code === 7 || code === 31) {
    return "LIVE";
  }
  if (type === "postponed" || desc === "POSTPONED" || code === 60) {
    return "POSTPONED";
  }
  if (type === "canceled" || desc === "CANCELED" || desc === "CANCELLED" || code === 70) {
    return "VOID";
  }
  if (type === "suspended" || desc === "SUSPENDED" || code === 50) {
    return "SUSPENDED";
  }
  return "SCHEDULED";
}

function calculateElapsed(status: string, rawEvent: any): number | null {
  if (status === "FINISHED") return 90;
  if (status !== "LIVE") return null;

  const desc = String(rawEvent.status?.description || "").toLowerCase();
  const isHalftime = (desc.includes("half") && !desc.includes("1st") && !desc.includes("2nd")) || rawEvent.status?.code === 31;
  if (isHalftime) return 45;

  const isSecondHalf = desc.includes("2nd") || rawEvent.lastPeriod === "period2" || rawEvent.status?.code === 7;
  const baseMinutes = isSecondHalf ? 45 : 0;
  const timestamp = rawEvent.time?.currentPeriodStartTimestamp || rawEvent.statusTime?.timestamp;

  if (timestamp) {
    const calc = baseMinutes + Math.floor((Date.now() / 1000 - timestamp) / 60);
    return Math.min(130, Math.max(1, calc));
  }
  return isSecondHalf ? 46 : 1;
}

/**
 * Retrieves the latest match live details (score, incidents, stats, lineups, odds)
 * combining real-time WebSocket memory, MongoDB persistence, and REST recovery fallback.
 */
export async function getOrFetchMatchDetails(
  matchId: string,
  forceRefresh = false,
): Promise<LiveMatchSnapshot | null> {
  // 1. Ensure the automated background WebSocket daemon is active and listening
  ensureSportsApiBackgroundService();

  const monitor = getMatchMonitorService();

  // 2. Ensure real-time WebSocket channels for this match are actively subscribed
  monitor.subscribeMatchChannels(matchId);

  // 3. Check in-memory snapshot if it already has rich data with a valid score
  const inMemory = monitor.getSnapshot(matchId);
  const inMemoryHasScore = inMemory.score.home !== null && inMemory.score.status !== "SCHEDULED";
  const inMemoryHasContent = Boolean(
    inMemory.lineups?.home?.players?.length ||
    inMemory.lineups?.away?.players?.length ||
    inMemory.stats?.length > 0 ||
    inMemory.incidents?.length > 0,
  );

  if (!forceRefresh && inMemoryHasScore && inMemoryHasContent) {
    return inMemory;
  }

  // 4. Load from MongoDB matchDetails collection
  const fromDb = await monitor.loadSnapshotFromDb(matchId);
  const dbHasScore = fromDb.score.home !== null && fromDb.score.status !== "SCHEDULED";
  const dbHasContent = Boolean(
    fromDb.lineups?.home?.players?.length ||
    fromDb.lineups?.away?.players?.length ||
    fromDb.stats?.length > 0 ||
    fromDb.incidents?.length > 0,
  );

  const isFresh = Date.now() - fromDb.lastUpdateAt < 45_000;
  if (!forceRefresh && dbHasScore && dbHasContent && (fromDb.score.status === "FINISHED" || isFresh)) {
    return fromDb;
  }

  // On the Free plan, WebSocket ingestion is authoritative for rich match
  // data. Return the accumulated local state instead of silently spending
  // quota on four detail REST calls when a channel has no snapshot yet.
  if (!env.SPORTSAPI_DETAIL_REST_ENABLED) {
    return fromDb;
  }

  // 5. In-flight deduplication (SingleFlight pattern)
  if (inFlight.has(matchId)) {
    return inFlight.get(matchId)!;
  }

  const promise = (async () => {
    try {
      const db = await getDb();

      // Fetch match overview, incidents, statistics, and lineups in parallel
      const [matchRes, incidentsRes, statsRes, lineupsRes] = await Promise.allSettled([
        fetchSportsApi<any>(`/match/${matchId}`),
        fetchSportsApi<any>(`/match/${matchId}/incidents`),
        fetchSportsApi<any>(`/match/${matchId}/statistics`),
        fetchSportsApi<any>(`/match/${matchId}/lineups`),
      ]);

      const matchRaw: any = matchRes.status === "fulfilled" ? matchRes.value : null;
      const ev =
        matchRaw?.match ||
        matchRaw?.event ||
        matchRaw?.data?.match ||
        matchRaw?.data?.event ||
        matchRaw?.data ||
        matchRaw;

      // Parse Incidents
      const incidentsRaw: any = incidentsRes.status === "fulfilled" ? incidentsRes.value : null;
      const rawIncidents =
        incidentsRaw?.incidents ||
        incidentsRaw?.data?.incidents ||
        (Array.isArray(incidentsRaw?.data)
          ? incidentsRaw.data
          : Array.isArray(incidentsRaw)
            ? incidentsRaw
            : []);

      const incidents: LiveIncident[] = [];
      for (const inc of rawIncidents) {
        let type: LiveIncident["type"] = "other";
        const rawType = String(inc.incidentType || "").toLowerCase();
        if (rawType.includes("goal")) type = "goal";
        else if (rawType.includes("card")) type = "card";
        else if (rawType.includes("sub")) type = "substitution";
        else if (rawType.includes("period")) type = "period";
        else if (rawType.includes("var")) type = "var";
        else if (rawType.includes("injury")) type = "injury_time";

        let cardType: LiveIncident["cardType"] = undefined;
        if (type === "card") {
          if (inc.incidentClass === "yellow") cardType = "yellow";
          else if (inc.incidentClass === "red") cardType = "red";
          else if (inc.incidentClass === "yellowRed") cardType = "yellow_red";
        }

        incidents.push({
          id: String(inc.id || `${type}-${inc.time}-${inc.player?.name || ""}`),
          type,
          time: inc.time ?? 0,
          addedTime: inc.addedTime ?? null,
          isHome: Boolean(inc.isHome),
          playerName: inc.player?.name || inc.player?.shortName,
          playerInName: inc.playerIn?.name || inc.playerIn?.shortName,
          playerOutName: inc.playerOut?.name || inc.playerOut?.shortName,
          assistName: extractAssistName(inc),
          cardType,
          score:
            inc.homeScore !== undefined && inc.awayScore !== undefined
              ? { home: inc.homeScore, away: inc.awayScore }
              : undefined,
          detail: inc.text || inc.incidentClass || inc.description,
          raw: inc,
        });
      }

      // Parse Score and Status
      let status = parseCanonicalStatus(ev?.status);
      let elapsed = ev ? calculateElapsed(status, ev) : null;

      let homeGoals = ev?.homeScore?.display ?? ev?.homeScore?.current ?? ev?.homeScore?.normaltime ?? null;
      let awayGoals = ev?.awayScore?.display ?? ev?.awayScore?.current ?? ev?.awayScore?.normaltime ?? null;

      // If scores not directly on match object, derive from incidents
      if (homeGoals === null && incidents.length > 0) {
        const lastScoredInc = [...incidents].reverse().find((i) => i.score);
        if (lastScoredInc?.score) {
          homeGoals = lastScoredInc.score.home;
          awayGoals = lastScoredInc.score.away;
        }
      }

      // If status is SCHEDULED but has FT incident or elapsed time
      const hasFt = incidents.some((i) => i.type === "period" && (i.detail?.includes("FT") || i.detail?.includes("Ended")));
      if (hasFt) {
        status = "FINISHED";
        elapsed = 90;
      }

      const score = {
        home: homeGoals ?? fromDb.score.home ?? null,
        away: awayGoals ?? fromDb.score.away ?? null,
        period1: {
          home: ev?.homeScore?.period1 ?? fromDb.score.period1?.home ?? null,
          away: ev?.awayScore?.period1 ?? fromDb.score.period1?.away ?? null,
        },
        period2: {
          home: ev?.homeScore?.period2 ?? fromDb.score.period2?.home ?? null,
          away: ev?.awayScore?.period2 ?? fromDb.score.period2?.away ?? null,
        },
        status: status !== "SCHEDULED" ? status : fromDb.score.status || "SCHEDULED",
        elapsed: elapsed ?? fromDb.score.elapsed ?? null,
        statusDescription: ev?.status?.description || fromDb.score.statusDescription,
      };

      // Parse Statistics
      const statsRaw: any = statsRes.status === "fulfilled" ? statsRes.value : null;
      const statsPayload = statsRaw?.statistics || statsRaw?.data?.statistics || statsRaw?.data || statsRaw;
      const rawStats = Array.isArray(statsPayload) ? statsPayload : statsPayload?.periods || statsPayload?.groups || [];

      const stats: LiveStatGroup[] = [];
      for (const periodGroup of rawStats) {
        if (periodGroup.groups) {
          for (const g of periodGroup.groups) {
            stats.push({
              groupName: g.groupName || "Stats",
              items: (g.statisticsItems || []).map((it: any) => ({
                ...it,
                name: it.name || it.label || "Statistic",
                home: it.home ?? it.homeValue ?? "-",
                away: it.away ?? it.awayValue ?? "-",
                homeValue: it.homeValue,
                awayValue: it.awayValue,
                raw: it,
              })),
            });
          }
        }
      }

      // Parse Lineups
      const lineupsRaw: any = lineupsRes.status === "fulfilled" ? lineupsRes.value : null;
      const lineupsData: any =
        lineupsRaw?.home || lineupsRaw?.away ? lineupsRaw : lineupsRaw?.data || null;

      let lineups: LiveLineups | null = null;
      if (lineupsData?.home || lineupsData?.away) {
        const parsePlayers = (list: any[]) =>
          (list || []).map((item: any) => ({
            id: item.player?.id || 0,
            name: item.player?.name || item.name || "Player",
            shortName: item.player?.shortName || item.shortName,
            number: item.player?.jerseyNumber || item.jerseyNumber || "",
            position: item.player?.position || item.position,
            substitute: Boolean(item.substitute),
          }));

        const homePlayers = parsePlayers(lineupsData.home?.players);
        const awayPlayers = parsePlayers(lineupsData.away?.players);

        if (homePlayers.length > 0 || awayPlayers.length > 0) {
          lineups = {
            confirmed: Boolean(lineupsData.confirmed),
            home: {
              formation: lineupsData.home?.formation,
              players: homePlayers.filter((p) => !p.substitute),
              substitutes: homePlayers.filter((p) => p.substitute),
            },
            away: {
              formation: lineupsData.away?.formation,
              players: awayPlayers.filter((p) => !p.substitute),
              substitutes: awayPlayers.filter((p) => p.substitute),
            },
          };
        }
      }

      const finalIncidents = incidents.length > 0 ? incidents : fromDb.incidents || [];
      const finalStats = stats.length > 0 ? stats : fromDb.stats || [];
      const finalLineups = lineups || fromDb.lineups || null;

      const snapshot: LiveMatchSnapshot = {
        matchId,
        score,
        incidents: finalIncidents,
        stats: finalStats,
        lineups: finalLineups,
        odds: fromDb.odds || [],
        lastUpdateAt: Date.now(),
      };

      // Update in-memory monitor cache
      monitor.updateFromSnapshot(snapshot);

      // Persist to MongoDB matchDetails collection
      await db.collection("matchDetails").updateOne(
        { matchId },
        {
          $set: {
            matchId,
            provider: "sportsapi",
            score,
            incidents: finalIncidents,
            stats: finalStats,
            lineups: finalLineups,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      // Keep main matches collection in sync with score/status/elapsed
      const updateFields: any = { updatedAt: new Date() };
      if (score.status) updateFields.status = score.status;
      if (score.home !== null && score.home !== undefined) updateFields.homeGoals = score.home;
      if (score.away !== null && score.away !== undefined) updateFields.awayGoals = score.away;
      if (score.elapsed !== null && score.elapsed !== undefined) updateFields.elapsed = score.elapsed;

      await db.collection("matches").updateOne(
        { provider: "sportsapi", providerMatchId: matchId },
        { $set: updateFields },
      );

      // If status is FINISHED, run scoring engine
      if (score.status === "FINISHED") {
        try {
          await runScoreEngine();
        } catch (scoreErr) {
          console.error("[MatchDetails] Error running scoreEngine:", scoreErr);
        }
      }

      return snapshot;
    } catch (err) {
      console.error(`[MatchDetails] Error updating match ${matchId}:`, err);
      return fromDb;
    } finally {
      inFlight.delete(matchId);
    }
  })();

  inFlight.set(matchId, promise);
  return promise;
}
