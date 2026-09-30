import { getDb } from "@/lib/db/mongo";
import { env } from "@/lib/env";
import type {
  LiveMatchSnapshot,
  LiveIncident,
  LiveStatGroup,
  LiveLineups,
  LiveOddsMarket,
} from "./matchMonitor";
import { ensureSportsApiBackgroundService } from "./backgroundService";

const inFlight = new Map<string, Promise<LiveMatchSnapshot | null>>();

export async function getOrFetchMatchDetails(
  matchId: string,
  forceRefresh = false,
): Promise<LiveMatchSnapshot | null> {
  // Ensure the automated background WS daemon is running
  ensureSportsApiBackgroundService();

  const db = await getDb();

  // 1. Check MongoDB first for instant return
  const existing = await db
    .collection<any>("matchDetails")
    .findOne({ matchId });

  if (!forceRefresh && existing) {
    const ageMs = Date.now() - new Date(existing.updatedAt).getTime();
    const isFinished = existing.score?.status === "FINISHED";
    const hasContent = Boolean(
      existing.lineups?.home?.players?.length ||
      existing.lineups?.away?.players?.length ||
      (existing.stats && existing.stats.length > 0) ||
      (existing.incidents && existing.incidents.length > 0),
    );

    // Only return cached if it has real content, or if recently refreshed
    if ((isFinished && hasContent) || (!isFinished && ageMs < 45_000 && hasContent)) {
      return {
        matchId: existing.matchId,
        score: existing.score,
        incidents: existing.incidents || [],
        stats: existing.stats || [],
        lineups: existing.lineups || null,
        odds: existing.odds || [],
        lastUpdateAt: new Date(existing.updatedAt).getTime(),
      };
    }
  }

  // 2. In-flight deduplication (SingleFlight pattern)
  if (inFlight.has(matchId)) {
    return inFlight.get(matchId)!;
  }

  const promise = (async () => {
    try {
      const apiKey = env.SPORTSAPI_API_KEY || process.env.SPORTSAPI_API_KEY;
      if (!apiKey) {
        if (existing) {
          return {
            matchId: existing.matchId,
            score: existing.score,
            incidents: existing.incidents || [],
            stats: existing.stats || [],
            lineups: existing.lineups || null,
            odds: existing.odds || [],
            lastUpdateAt: new Date(existing.updatedAt).getTime(),
          };
        }
        return null;
      }

      const baseUrl = env.SPORTSAPI_BASE_URL || "https://api.sportsapipro.com/v2/football";
      const headers = { "x-api-key": apiKey, Accept: "application/json" };

      // Helper to safely fetch endpoint with error & rate-limit handling
      const fetchJson = async (endpoint: string) => {
        try {
          const res = await fetch(`${baseUrl}${endpoint}`, {
            headers,
            cache: "no-store",
          });
          if (res.status === 429) {
            console.warn(`[SportsAPI] Rate limit reached (429) on ${endpoint}`);
            return null;
          }
          if (!res.ok) return null;
          return await res.json();
        } catch (fetchErr) {
          console.warn(`[SportsAPI] Fetch error on ${endpoint}:`, fetchErr);
          return null;
        }
      };

      // Fetch all sub-resources in parallel
      const [matchRes, incidentsRes, statsRes, lineupsRes, oddsRes] = await Promise.allSettled([
        fetchJson(`/match/${matchId}`),
        fetchJson(`/match/${matchId}/incidents`),
        fetchJson(`/match/${matchId}/statistics`),
        fetchJson(`/match/${matchId}/lineups`),
        fetchJson(`/match/${matchId}/odds`),
      ]);

      const matchRaw = matchRes.status === "fulfilled" ? matchRes.value : null;
      const ev =
        matchRaw?.match ||
        matchRaw?.event ||
        matchRaw?.data?.match ||
        matchRaw?.data?.event ||
        matchRaw?.data ||
        matchRaw;

      // Verify that we received valid match information
      const hasValidMatchInfo = Boolean(
        ev && (ev.status || ev.homeScore || ev.homeTeam || ev.awayTeam),
      );

      // If REST call failed completely (e.g. rate limit 429 or 503), NEVER overwrite DB with blank data
      if (!hasValidMatchInfo) {
        if (existing) {
          return {
            matchId: existing.matchId,
            score: existing.score,
            incidents: existing.incidents || [],
            stats: existing.stats || [],
            lineups: existing.lineups || null,
            odds: existing.odds || [],
            lastUpdateAt: new Date(existing.updatedAt).getTime(),
          };
        }

        const matchRecord = await db.collection<any>("matches").findOne({
          provider: "sportsapi",
          providerMatchId: matchId,
        });

        if (matchRecord) {
          return {
            matchId,
            score: {
              home: matchRecord.homeGoals ?? null,
              away: matchRecord.awayGoals ?? null,
              status: matchRecord.status || "SCHEDULED",
              elapsed: matchRecord.elapsed ?? null,
            },
            incidents: [],
            stats: [],
            lineups: null,
            odds: [],
            lastUpdateAt: Date.now(),
          };
        }
        return null;
      }

      // 1. Parse Score & Status
      let status = "SCHEDULED";
      if (ev.status) {
        const type = String(ev.status.type || "").toLowerCase();
        if (type === "inprogress") status = "LIVE";
        else if (type === "finished") status = "FINISHED";
        else if (type === "notstarted") status = "SCHEDULED";
        else status = ev.status.description?.toUpperCase() || status;
      }

      const score = {
        home: ev.homeScore?.display ?? ev.homeScore?.current ?? null,
        away: ev.awayScore?.display ?? ev.awayScore?.current ?? null,
        period1: {
          home: ev.homeScore?.period1 ?? null,
          away: ev.awayScore?.period1 ?? null,
        },
        period2: {
          home: ev.homeScore?.period2 ?? null,
          away: ev.awayScore?.period2 ?? null,
        },
        status,
        elapsed: ev.time?.currentPeriodStartTimestamp
          ? Math.floor((Date.now() / 1000 - ev.time.currentPeriodStartTimestamp) / 60)
          : null,
        statusDescription: ev.status?.description,
      };

      // 2. Parse Incidents
      const incidentsRaw = incidentsRes.status === "fulfilled" ? incidentsRes.value : null;
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
          cardType,
          score:
            inc.homeScore !== undefined && inc.awayScore !== undefined
              ? { home: inc.homeScore, away: inc.awayScore }
              : undefined,
          detail: inc.text || inc.incidentClass || inc.description,
        });
      }

      // 3. Parse Statistics
      const statsRaw = statsRes.status === "fulfilled" ? statsRes.value : null;
      const rawStats =
        statsRaw?.statistics ||
        statsRaw?.data?.statistics ||
        (Array.isArray(statsRaw?.data)
          ? statsRaw.data
          : Array.isArray(statsRaw)
            ? statsRaw
            : []);

      const stats: LiveStatGroup[] = [];
      for (const periodGroup of rawStats) {
        if (periodGroup.groups) {
          for (const g of periodGroup.groups) {
            stats.push({
              groupName: g.groupName || "Stats",
              items: (g.statisticsItems || []).map((it: any) => ({
                name: it.name,
                home: it.home,
                away: it.away,
                homeValue: it.homeValue,
                awayValue: it.awayValue,
              })),
            });
          }
        }
      }

      // 4. Parse Lineups
      const lineupsRaw = lineupsRes.status === "fulfilled" ? lineupsRes.value : null;
      const lineupsData =
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

      // 5. Parse Odds
      const oddsRaw = oddsRes.status === "fulfilled" ? oddsRes.value : null;
      const oddsData = oddsRaw?.data || oddsRaw;
      const odds: LiveOddsMarket[] = [];

      if (oddsData?.featured?.default) {
        const def = oddsData.featured.default;
        odds.push({
          name: def.marketName || "Full time",
          choices: (def.choices || []).map((c: any) => ({
            name: c.name,
            value: c.fractionalValue || c.decimalValue || "",
            fractionalValue: c.fractionalValue,
            change: c.change,
          })),
        });
      } else if (Array.isArray(oddsData?.markets)) {
        for (const m of oddsData.markets) {
          odds.push({
            name: m.marketName,
            choices: (m.choices || []).map((c: any) => ({
              name: c.name,
              value: c.fractionalValue || c.decimalValue || "",
              fractionalValue: c.fractionalValue,
              change: c.change,
            })),
          });
        }
      }

      // Merge with any existing fields in MongoDB to avoid wiping valid data on partial failure
      const finalIncidents =
        incidents.length > 0 ? incidents : existing?.incidents || [];
      const finalStats = stats.length > 0 ? stats : existing?.stats || [];
      const finalLineups = lineups || existing?.lineups || null;
      const finalOdds = odds.length > 0 ? odds : existing?.odds || [];

      const snapshot: LiveMatchSnapshot = {
        matchId,
        score,
        incidents: finalIncidents,
        stats: finalStats,
        lineups: finalLineups,
        odds: finalOdds,
        lastUpdateAt: Date.now(),
      };

      // 6. Save directly to MongoDB matchDetails collection
      const detailsUpdate: any = {
        matchId,
        provider: "sportsapi",
        score,
        updatedAt: new Date(),
      };
      if (finalIncidents.length > 0) detailsUpdate.incidents = finalIncidents;
      if (finalStats.length > 0) detailsUpdate.stats = finalStats;
      if (finalLineups) detailsUpdate.lineups = finalLineups;
      if (finalOdds.length > 0) detailsUpdate.odds = finalOdds;

      await db.collection("matchDetails").updateOne(
        { matchId },
        {
          $set: detailsUpdate,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      // Keep the main matches collection in sync with latest score/status
      const updateFields: any = { updatedAt: new Date() };
      if (score.status) updateFields.status = score.status;
      if (score.home !== null && score.home !== undefined) updateFields.homeGoals = score.home;
      if (score.away !== null && score.away !== undefined) updateFields.awayGoals = score.away;
      if (score.elapsed !== null && score.elapsed !== undefined) updateFields.elapsed = score.elapsed;

      await db.collection("matches").updateOne(
        { provider: "sportsapi", providerMatchId: matchId },
        { $set: updateFields },
      );

      // Trigger score engine if match is now FINISHED
      if (score.status === "FINISHED") {
        try {
          const { runScoreEngine } = await import("@/lib/scoring/scoreEngine");
          await runScoreEngine();
        } catch (scoreErr) {
          console.error("[MatchDetails] Error running scoreEngine:", scoreErr);
        }
      }

      return snapshot;
    } catch (err) {
      console.error(`[MatchDetails] Failed to fetch details for ${matchId}:`, err);
      if (existing) {
        return {
          matchId: existing.matchId,
          score: existing.score,
          incidents: existing.incidents || [],
          stats: existing.stats || [],
          lineups: existing.lineups || null,
          odds: existing.odds || [],
          lastUpdateAt: new Date(existing.updatedAt).getTime(),
        };
      }
      return null;
    } finally {
      inFlight.delete(matchId);
    }
  })();

  inFlight.set(matchId, promise);
  return promise;
}
