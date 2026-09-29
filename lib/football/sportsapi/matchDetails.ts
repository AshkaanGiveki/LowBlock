import { getDb } from "@/lib/db/mongo";
import { env } from "@/lib/env";
import type {
  LiveMatchSnapshot,
  LiveIncident,
  LiveStatGroup,
  LiveLineups,
  LiveOddsMarket,
} from "./matchMonitor";

const inFlight = new Map<string, Promise<LiveMatchSnapshot | null>>();

export async function getOrFetchMatchDetails(
  matchId: string,
  forceRefresh = false,
): Promise<LiveMatchSnapshot | null> {
  const db = await getDb();

  // 1. Check MongoDB first for instant return
  if (!forceRefresh) {
    const existing = await db
      .collection<any>("matchDetails")
      .findOne({ matchId });

    if (existing) {
      const ageMs = Date.now() - new Date(existing.updatedAt).getTime();
      const isFinished = existing.score?.status === "FINISHED";

      // If finished, data is immutable; if live/scheduled and fresh (< 45s), return cached
      if (isFinished || ageMs < 45_000) {
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
  }

  // 2. In-flight deduplication (SingleFlight pattern)
  if (inFlight.has(matchId)) {
    return inFlight.get(matchId)!;
  }

  const promise = (async () => {
    try {
      const apiKey = env.SPORTSAPI_API_KEY || process.env.SPORTSAPI_API_KEY;
      if (!apiKey) return null;

      const baseUrl = env.SPORTSAPI_BASE_URL || "https://api.sportsapipro.com/v2/football";
      const headers = { "x-api-key": apiKey, Accept: "application/json" };

      // Fetch all sub-resources in parallel
      const [matchRes, incidentsRes, statsRes, lineupsRes, oddsRes] = await Promise.allSettled([
        fetch(`${baseUrl}/match/${matchId}`, { headers }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${baseUrl}/match/${matchId}/incidents`, { headers }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${baseUrl}/match/${matchId}/statistics`, { headers }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${baseUrl}/match/${matchId}/lineups`, { headers }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${baseUrl}/match/${matchId}/odds`, { headers }).then((r) => (r.ok ? r.json() : null)),
      ]);

      const matchData = matchRes.status === "fulfilled" ? matchRes.value?.data || matchRes.value : null;
      const ev = matchData?.event || matchData || {};

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
      const incidentsData = incidentsRes.status === "fulfilled" ? incidentsRes.value?.data || incidentsRes.value : null;
      const rawIncidents = incidentsData?.incidents || (Array.isArray(incidentsData) ? incidentsData : []);
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
      const statsData = statsRes.status === "fulfilled" ? statsRes.value?.data || statsRes.value : null;
      const rawStats = statsData?.statistics || (Array.isArray(statsData) ? statsData : []);
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
      const lineupsData = lineupsRes.status === "fulfilled" ? lineupsRes.value?.data || lineupsRes.value : null;
      let lineups: LiveLineups | null = null;

      if (lineupsData?.home || lineupsData?.away) {
        const parsePlayers = (list: any[]) =>
          (list || []).map((item: any) => ({
            id: item.player?.id || 0,
            name: item.player?.name || "Player",
            shortName: item.player?.shortName,
            number: item.player?.jerseyNumber || "",
            position: item.player?.position,
            substitute: Boolean(item.substitute),
          }));

        const homePlayers = parsePlayers(lineupsData.home?.players);
        const awayPlayers = parsePlayers(lineupsData.away?.players);

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

      // 5. Parse Odds
      const oddsData = oddsRes.status === "fulfilled" ? oddsRes.value?.data || oddsRes.value : null;
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

      const snapshot: LiveMatchSnapshot = {
        matchId,
        score,
        incidents,
        stats,
        lineups,
        odds,
        lastUpdateAt: Date.now(),
      };

      // 6. Save directly to MongoDB matchDetails collection
      await db.collection("matchDetails").updateOne(
        { matchId },
        {
          $set: {
            matchId,
            provider: "sportsapi",
            score,
            incidents,
            stats,
            lineups,
            odds,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      // Also keep the main matches collection in sync with latest score/status
      const updateFields: any = { updatedAt: new Date() };
      if (score.status) updateFields.status = score.status;
      if (score.home !== null) updateFields.homeGoals = score.home;
      if (score.away !== null) updateFields.awayGoals = score.away;
      if (score.elapsed !== null) updateFields.elapsed = score.elapsed;

      await db.collection("matches").updateOne(
        { provider: "sportsapi", providerMatchId: matchId },
        { $set: updateFields },
      );

      return snapshot;
    } catch (err) {
      console.error(`[MatchDetails] Failed to fetch details for ${matchId}:`, err);
      return null;
    } finally {
      inFlight.delete(matchId);
    }
  })();

  inFlight.set(matchId, promise);
  return promise;
}
