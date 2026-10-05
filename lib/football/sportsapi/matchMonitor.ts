import { getSportsApiWsManager } from "./ws";
import { getDb } from "@/lib/db/mongo";

export type LiveMatchScore = {
  home: number | null;
  away: number | null;
  period1?: { home: number | null; away: number | null };
  period2?: { home: number | null; away: number | null };
  status: string;
  elapsed: number | null;
  statusDescription?: string;
};

export type LiveIncident = {
  id: string;
  type: "goal" | "card" | "substitution" | "period" | "var" | "injury_time" | "other";
  time: number;
  addedTime?: number | null;
  isHome?: boolean;
  playerName?: string;
  playerInName?: string;
  playerOutName?: string;
  assistName?: string | null;
  cardType?: "yellow" | "red" | "yellow_red";
  score?: { home: number; away: number };
  detail?: string;
};

export type LiveStatItem = {
  name: string;
  home: string | number;
  away: string | number;
  homeValue?: number;
  awayValue?: number;
  raw?: Record<string, unknown>;
};

export type LiveStatGroup = {
  groupName: string;
  items: LiveStatItem[];
};

export type LiveLineupPlayer = {
  id: number;
  name: string;
  shortName?: string;
  number?: string | number;
  position?: string;
  substitute?: boolean;
};

export type LiveLineups = {
  confirmed: boolean;
  home: {
    formation?: string;
    players: LiveLineupPlayer[];
    substitutes: LiveLineupPlayer[];
  };
  away: {
    formation?: string;
    players: LiveLineupPlayer[];
    substitutes: LiveLineupPlayer[];
  };
};

export type LiveOddsChoice = {
  name: string;
  value: string;
  fractionalValue?: string;
  change?: number;
};

export type LiveOddsMarket = {
  name: string;
  choices: LiveOddsChoice[];
};

export type LiveMatchSnapshot = {
  matchId: string;
  score: LiveMatchScore;
  incidents: LiveIncident[];
  stats: LiveStatGroup[];
  lineups: LiveLineups | null;
  odds: LiveOddsMarket[];
  rawProviderPayload?: Record<string, unknown>;
  lastUpdateAt: number;
};

type StateListener = (snapshot: LiveMatchSnapshot) => void;

/** SportsAPI live updates use flattened delta keys such as
 * `homeScore.current` and `status.code`. Rebuild the nested shape before
 * applying them so deltas are never silently discarded. */
function expandProviderDelta(value: any): any {
  if (Array.isArray(value)) return value.map(expandProviderDelta);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, any> = {};
  for (const [key, raw] of Object.entries(value)) {
    const expanded = expandProviderDelta(raw);
    if (!key.includes(".")) {
      output[key] = expanded;
      continue;
    }

    const parts = key.split(".");
    let cursor = output;
    for (const part of parts.slice(0, -1)) {
      cursor[part] ||= {};
      cursor = cursor[part];
    }
    cursor[parts.at(-1)!] = expanded;
  }
  return output;
}

function providerEventId(event: any): string {
  return String(
    event?.id ??
      event?.eventId ??
      event?.matchId ??
      event?.fixtureId ??
      event?.event?.id ??
      event?.event?.eventId ??
      event?.match?.id ??
      "",
  );
}

function providerScoreValue(value: any, fallback: number | null): number | null {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return fallback;
  return value.display ?? value.current ?? value.normaltime ?? fallback;
}

function providerPeriodStart(event: any): number | null {
  const timestamp =
    event?.time?.currentPeriodStartTimestamp ??
    event?.statusTime?.timestamp ??
    event?.currentPeriodStartTimestamp;
  const numeric = Number(timestamp);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

class MatchMonitorService {
  private snapshots = new Map<string, LiveMatchSnapshot>();
  private listeners = new Map<string, Set<StateListener>>();
  private initialized = false;

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;

    const ws = getSportsApiWsManager();
    ws.connect();

    ws.addListener((channel: string, payload: any) => {
      this.handleWsMessage(channel, payload);
    });
  }

  public getSnapshot(matchId: string): LiveMatchSnapshot {
    this.ensureInitialized();
    let snapshot = this.snapshots.get(matchId);
    if (!snapshot) {
      snapshot = {
        matchId,
        score: {
          home: null,
          away: null,
          status: "SCHEDULED",
          elapsed: null,
        },
        incidents: [],
        stats: [],
        lineups: null,
        odds: [],
        rawProviderPayload: {},
        lastUpdateAt: Date.now(),
      };
      this.snapshots.set(matchId, snapshot);
      this.subscribeMatchChannels(matchId);
    }
    return snapshot;
  }

  public updateFromSnapshot(snapshot: LiveMatchSnapshot): void {
    this.ensureInitialized();
    this.snapshots.set(snapshot.matchId, snapshot);
    this.broadcast(snapshot.matchId, snapshot);
  }

  public async loadSnapshotFromDb(matchId: string): Promise<LiveMatchSnapshot> {
    this.ensureInitialized();
    let snapshot = this.snapshots.get(matchId);
    if (!snapshot) {
      snapshot = {
        matchId,
        score: {
          home: null,
          away: null,
          status: "SCHEDULED",
          elapsed: null,
        },
        incidents: [],
        stats: [],
        lineups: null,
        odds: [],
        rawProviderPayload: {},
        lastUpdateAt: Date.now(),
      };
      this.snapshots.set(matchId, snapshot);
    }

    try {
      const db = await getDb();
      const existing = await db.collection<any>("matchDetails").findOne({ matchId });
      if (existing) {
        if (existing.score) snapshot.score = { ...snapshot.score, ...existing.score };
        if (existing.incidents && existing.incidents.length > 0) snapshot.incidents = existing.incidents;
        if (existing.stats && existing.stats.length > 0) snapshot.stats = existing.stats;
        if (existing.lineups) snapshot.lineups = existing.lineups;
        if (existing.odds && existing.odds.length > 0) snapshot.odds = existing.odds;
        if (existing.rawProviderPayload) snapshot.rawProviderPayload = existing.rawProviderPayload;
        if (existing.updatedAt) snapshot.lastUpdateAt = new Date(existing.updatedAt).getTime();
      }

      // The details document may already contain lineups/stats/incidents while
      // the score fields are still empty. Always merge the canonical match
      // row as a score fallback instead of requiring one document or the other.
      const matchRecord = await db.collection<any>("matches").findOne({
        provider: "sportsapi",
        providerMatchId: matchId,
      });
      if (matchRecord) {
        snapshot.score.home ??= matchRecord.homeGoals ?? null;
        snapshot.score.away ??= matchRecord.awayGoals ?? null;
        if (snapshot.score.status === "SCHEDULED") {
          snapshot.score.status = matchRecord.status || "SCHEDULED";
        }
        snapshot.score.elapsed ??= matchRecord.elapsed ?? null;
      }
    } catch (err) {
      console.error("[MatchMonitor] Error loading snapshot from DB:", err);
    }

    return snapshot;
  }

  public subscribeToMatch(matchId: string, listener: StateListener): () => void {
    this.ensureInitialized();
    if (!this.listeners.has(matchId)) {
      this.listeners.set(matchId, new Set());
    }
    this.listeners.get(matchId)!.add(listener);

    // Ensure channels are subscribed
    this.subscribeMatchChannels(matchId);

    // Immediately send current snapshot
    listener(this.getSnapshot(matchId));

    return () => {
      const set = this.listeners.get(matchId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(matchId);
        }
      }
    };
  }

  public subscribeMatchChannels(matchId: string) {
    const ws = getSportsApiWsManager();
    ws.subscribeToChannel(`match:${matchId}`);
    ws.subscribeToChannel(`match:${matchId}:incidents`);
    ws.subscribeToChannel(`match:${matchId}:stats`);
    ws.subscribeToChannel(`match:${matchId}:lineups`);
    ws.subscribeToChannel(`match:${matchId}:odds`);
  }

  public handleWsMessage(channel: string, payload: any) {
    if (!payload) return;
    const data = expandProviderDelta(payload?.data || payload);
    if (!data) return;

    // Handle global live-scores feed
    if (channel === "live-scores" || channel === "live-scores:football") {
      this.handleLiveScoresMessage(data);
      return;
    }

    // Check if channel belongs to a match
    const matchMatch = channel.match(/^match:(\d+)(?::(incidents|stats|lineups|odds))?$/);
    if (!matchMatch) return;

    const matchId = matchMatch[1];
    const subType = matchMatch[2]; // undefined (score/match), incidents, stats, lineups, odds

    const snapshot = this.getSnapshot(matchId);
    snapshot.rawProviderPayload ||= {};
    snapshot.rawProviderPayload[subType || "score"] = payload;
    snapshot.lastUpdateAt = Date.now();

    if (!subType) {
      // Main match update (score, status, time)
      const ev = data.event || data.match || data.data?.event || data.data?.match || data;
      if (ev.status) {
        const type = String(ev.status.type || "").toLowerCase();
        const desc = String(ev.status.description || "").toUpperCase();
        if (type === "finished" || desc === "ENDED" || desc === "FT" || desc === "AET" || desc === "AFTER ET" || ev.status.code === 100) {
          snapshot.score.status = "FINISHED";
          snapshot.score.elapsed = 90;
        } else if (type === "inprogress" || desc === "INPROGRESS" || desc === "1ST HALF" || desc === "2ND HALF" || desc === "HALFTIME") {
          snapshot.score.status = "LIVE";
        } else if (type === "notstarted" || desc === "NOT STARTED" || ev.status.code === 0) {
          snapshot.score.status = "SCHEDULED";
          snapshot.score.elapsed = null;
        } else {
          snapshot.score.status = desc || snapshot.score.status;
        }
        snapshot.score.statusDescription = ev.status.description;
      }
      if (ev.homeScore) {
        snapshot.score.home = ev.homeScore.display ?? ev.homeScore.current ?? snapshot.score.home;
        snapshot.score.period1 = {
          home: ev.homeScore.period1 ?? snapshot.score.period1?.home ?? null,
          away: ev.awayScore?.period1 ?? snapshot.score.period1?.away ?? null,
        };
        snapshot.score.period2 = {
          home: ev.homeScore.period2 ?? snapshot.score.period2?.home ?? null,
          away: ev.awayScore?.period2 ?? snapshot.score.period2?.away ?? null,
        };
      }
      if (ev.awayScore) {
        snapshot.score.away = ev.awayScore.display ?? ev.awayScore.current ?? snapshot.score.away;
      }
      if (snapshot.score.status === "FINISHED") {
        snapshot.score.elapsed = 90;
      } else if (snapshot.score.status === "SCHEDULED") {
        snapshot.score.elapsed = null;
      } else if (ev.time?.currentPeriodStartTimestamp) {
        const calc = Math.floor(
          (Date.now() / 1000 - ev.time.currentPeriodStartTimestamp) / 60,
        );
        snapshot.score.elapsed = Math.min(130, Math.max(1, calc));
      }
    } else if (subType === "incidents") {
      const rawIncidents = data.incidents || data.data?.incidents || (Array.isArray(data) ? data : []);
      const parsed: LiveIncident[] = [];
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

        parsed.push({
          id: String(inc.id || `${type}-${inc.time}-${inc.player?.name || ""}`),
          type,
          time: inc.time ?? 0,
          addedTime: inc.addedTime ?? null,
          isHome: Boolean(inc.isHome),
          playerName: inc.player?.name || inc.player?.shortName,
          playerInName: inc.playerIn?.name || inc.playerIn?.shortName,
          playerOutName: inc.playerOut?.name || inc.playerOut?.shortName,
          assistName: inc.assist1?.name || inc.assist1?.shortName || inc.assist?.name || inc.assist?.shortName || null,
          cardType,
          score:
            inc.homeScore !== undefined && inc.awayScore !== undefined
              ? { home: inc.homeScore, away: inc.awayScore }
              : undefined,
          detail: inc.text || inc.incidentClass || inc.description,
        });
      }
      if (parsed.length > 0) {
        const byId = new Map(snapshot.incidents.map((incident) => [incident.id, incident]));
        for (const incident of parsed) byId.set(incident.id, incident);
        snapshot.incidents = Array.from(byId.values()).sort((a, b) => a.time - b.time);
      }
    } else if (subType === "stats") {
      const statsPayload = data.statistics || data.data?.statistics || data;
      const statsObj = Array.isArray(statsPayload) ? statsPayload : statsPayload?.periods || statsPayload?.groups || [];
      const groups: LiveStatGroup[] = [];
      for (const periodGroup of statsObj) {
        if (periodGroup.groups) {
          for (const g of periodGroup.groups) {
            groups.push({
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
      if (groups.length > 0) {
        snapshot.stats = groups;
      }
    } else if (subType === "lineups") {
      const lineupsObj = data.home || data.away ? data : data.data || data;
      const homeRaw = lineupsObj.home || {};
      const awayRaw = lineupsObj.away || {};

      const parsePlayers = (list: any[]) =>
        (list || []).map((item: any) => ({
          id: item.player?.id || 0,
          name: item.player?.name || item.name || "Player",
          shortName: item.player?.shortName || item.shortName,
          number: item.player?.jerseyNumber || item.jerseyNumber || "",
          position: item.player?.position || item.position,
          substitute: Boolean(item.substitute),
        }));

      const homePlayers = parsePlayers(homeRaw.players);
      const awayPlayers = parsePlayers(awayRaw.players);

      if (homePlayers.length > 0 || awayPlayers.length > 0) {
        snapshot.lineups = {
          confirmed: Boolean(lineupsObj.confirmed),
          home: {
            formation: homeRaw.formation,
            players: homePlayers.filter((p) => !p.substitute),
            substitutes: homePlayers.filter((p) => p.substitute),
          },
          away: {
            formation: awayRaw.formation,
            players: awayPlayers.filter((p) => !p.substitute),
            substitutes: awayPlayers.filter((p) => p.substitute),
          },
        };
      }
    } else if (subType === "odds") {
      const marketsRaw = data.markets || data.data?.markets || [];
      const parsedMarkets: LiveOddsMarket[] = [];
      for (const m of marketsRaw) {
        parsedMarkets.push({
          name: m.marketName,
          choices: (m.choices || []).map((c: any) => ({
            name: c.name,
            value: c.fractionalValue || c.decimalValue || "",
            fractionalValue: c.fractionalValue,
            change: c.change,
          })),
        });
      }
      if (parsedMarkets.length > 0) {
        snapshot.odds = parsedMarkets;
      }
    }

    // Notify listeners (UI drawers)
    this.broadcast(matchId, snapshot);

    // Persist to MongoDB debounced
    this.persistMatchState(matchId, snapshot);
  }

  private handleLiveScoresMessage(data: any) {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.events)
        ? data.events
        : Array.isArray(data.data?.events)
          ? data.data.events
          : Array.isArray(data.updates)
            ? data.updates
            : [data.event || data.data?.event || data];

    for (const item of list) {
      if (!item) continue;
      const ev = expandProviderDelta(item.event || item);
      const matchId = providerEventId(ev);
      if (!matchId || matchId === "undefined") continue;

      const snapshot = this.snapshots.get(matchId);
      if (snapshot || matchId) {
        const snap = this.getSnapshot(matchId);
        snap.rawProviderPayload ||= {};
        snap.rawProviderPayload.liveScores = item;
        snap.lastUpdateAt = Date.now();

        if (ev.status) {
          const statusObject = typeof ev.status === "object" ? ev.status : { description: ev.status };
          const type = String(statusObject.type || "").toLowerCase();
          const desc = String(statusObject.description || "").toUpperCase();
          if (type === "finished" || desc === "ENDED" || desc === "FT" || desc === "AET" || desc === "AFTER ET" || ev.status.code === 100) {
            snap.score.status = "FINISHED";
            snap.score.elapsed = 90;
          } else if (type === "inprogress" || desc === "INPROGRESS" || desc === "1ST HALF" || desc === "2ND HALF" || desc === "HALFTIME") {
            snap.score.status = "LIVE";
          } else if (type === "notstarted" || desc === "NOT STARTED" || ev.status.code === 0) {
            snap.score.status = "SCHEDULED";
            snap.score.elapsed = null;
          } else {
            snap.score.status = desc || snap.score.status;
          }
          snap.score.statusDescription = statusObject.description;
        }

        if (ev.homeScore !== undefined) {
          snap.score.home = providerScoreValue(ev.homeScore, snap.score.home);
          snap.score.period1 = {
            home: ev.homeScore.period1 ?? snap.score.period1?.home ?? null,
            away: ev.awayScore?.period1 ?? snap.score.period1?.away ?? null,
          };
          snap.score.period2 = {
            home: ev.homeScore.period2 ?? snap.score.period2?.home ?? null,
            away: ev.awayScore?.period2 ?? snap.score.period2?.away ?? null,
          };
        }
        if (ev.awayScore !== undefined) {
          snap.score.away = providerScoreValue(ev.awayScore, snap.score.away);
        }
        if (snap.score.status === "FINISHED") {
          snap.score.elapsed = 90;
        } else if (snap.score.status === "SCHEDULED") {
          snap.score.elapsed = null;
        } else if (providerPeriodStart(ev)) {
          const calc = Math.floor(
            (Date.now() / 1000 - providerPeriodStart(ev)!) / 60,
          );
          snap.score.elapsed = Math.min(130, Math.max(1, calc));
        } else if (snap.score.status === "LIVE" && snap.score.elapsed == null) {
          // Some delta messages carry status/score but omit the clock anchor.
          // Keep the scoreboard visibly live until a timestamped update arrives.
          snap.score.elapsed = 1;
        }

        this.broadcast(matchId, snap);
        this.persistMatchState(matchId, snap);
      }
    }
  }

  private broadcast(matchId: string, snapshot: LiveMatchSnapshot) {
    const listeners = this.listeners.get(matchId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(snapshot);
        } catch (err) {
          console.error("[MatchMonitor] Listener error:", err);
        }
      }
    }
  }

  private lastDbSync = new Map<string, number>();

  private async persistMatchState(matchId: string, snapshot: LiveMatchSnapshot) {
    const now = Date.now();
    const last = this.lastDbSync.get(matchId) || 0;
    if (now - last < 5_000) return; // Debounce 5s
    this.lastDbSync.set(matchId, now);

    try {
      const db = await getDb();

      // 1. Update matches collection with latest score/status
      const updateFields: any = {
        updatedAt: new Date(),
      };
      if (snapshot.score.status) updateFields.status = snapshot.score.status;
      if (snapshot.score.home !== null && snapshot.score.home !== undefined) {
        updateFields.homeGoals = snapshot.score.home;
      }
      if (snapshot.score.away !== null && snapshot.score.away !== undefined) {
        updateFields.awayGoals = snapshot.score.away;
      }
      if (snapshot.score.elapsed !== null && snapshot.score.elapsed !== undefined) {
        updateFields.elapsed = snapshot.score.elapsed;
      }

      await db.collection("matches").updateOne(
        { provider: "sportsapi", providerMatchId: matchId },
        { $set: updateFields },
      );

      // 2. Persist to matchDetails collection
      const detailsUpdate: any = {
        matchId,
        provider: "sportsapi",
        score: snapshot.score,
        rawProviderPayload: snapshot.rawProviderPayload || {},
        updatedAt: new Date(),
      };
      if (snapshot.incidents && snapshot.incidents.length > 0) {
        detailsUpdate.incidents = snapshot.incidents;
      }
      if (snapshot.stats && snapshot.stats.length > 0) {
        detailsUpdate.stats = snapshot.stats;
      }
      if (
        snapshot.lineups &&
        (snapshot.lineups.home.players.length > 0 || snapshot.lineups.away.players.length > 0)
      ) {
        detailsUpdate.lineups = snapshot.lineups;
      }
      if (snapshot.odds && snapshot.odds.length > 0) {
        detailsUpdate.odds = snapshot.odds;
      }

      await db.collection("matchDetails").updateOne(
        { matchId },
        {
          $set: detailsUpdate,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      // 3. Trigger score engine if match is newly finished
      if (snapshot.score.status === "FINISHED") {
        try {
          const { runScoreEngine } = await import("@/lib/scoring/scoreEngine");
          await runScoreEngine();
        } catch (scoreErr) {
          console.error("[MatchMonitor] Error running scoreEngine on match finish:", scoreErr);
        }
      }
    } catch (err) {
      console.error("[MatchMonitor] Failed to persist state to MongoDB:", err);
    }
  }
}

// Global singleton
const globalForMonitor = globalThis as unknown as {
  matchMonitorService?: MatchMonitorService;
};

export function getMatchMonitorService(): MatchMonitorService {
  if (!globalForMonitor.matchMonitorService) {
    globalForMonitor.matchMonitorService = new MatchMonitorService();
  }
  return globalForMonitor.matchMonitorService;
}
