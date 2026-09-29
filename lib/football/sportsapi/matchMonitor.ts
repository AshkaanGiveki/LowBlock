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
  lastUpdateAt: number;
};

type StateListener = (snapshot: LiveMatchSnapshot) => void;

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
        lastUpdateAt: Date.now(),
      };
      this.snapshots.set(matchId, snapshot);
      this.subscribeMatchChannels(matchId);
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
          // Optional: unsubscribe from match channels after timeout
        }
      }
    };
  }

  private subscribeMatchChannels(matchId: string) {
    const ws = getSportsApiWsManager();
    ws.subscribeToChannel(`match:${matchId}`);
    ws.subscribeToChannel(`match:${matchId}:incidents`);
    ws.subscribeToChannel(`match:${matchId}:stats`);
    ws.subscribeToChannel(`match:${matchId}:lineups`);
    ws.subscribeToChannel(`match:${matchId}:odds`);
  }

  private handleWsMessage(channel: string, payload: any) {
    const data = payload?.data || payload;
    if (!data) return;

    // Check if channel belongs to a match
    const matchMatch = channel.match(/^match:(\d+)(?::(incidents|stats|lineups|odds))?$/);
    if (!matchMatch) return;

    const matchId = matchMatch[1];
    const subType = matchMatch[2]; // undefined (score/match), incidents, stats, lineups, odds

    const snapshot = this.getSnapshot(matchId);
    snapshot.lastUpdateAt = Date.now();

    if (!subType) {
      // Main match update (score, status, time)
      const ev = data.event || data;
      if (ev.status) {
        const type = String(ev.status.type || "").toLowerCase();
        if (type === "inprogress") snapshot.score.status = "LIVE";
        else if (type === "finished") snapshot.score.status = "FINISHED";
        else if (type === "notstarted") snapshot.score.status = "SCHEDULED";
        else snapshot.score.status = ev.status.description?.toUpperCase() || snapshot.score.status;
        snapshot.score.statusDescription = ev.status.description;
      }
      if (ev.homeScore) {
        snapshot.score.home = ev.homeScore.display ?? ev.homeScore.current ?? snapshot.score.home;
        snapshot.score.period1 = {
          home: ev.homeScore.period1 ?? null,
          away: ev.awayScore?.period1 ?? null,
        };
        snapshot.score.period2 = {
          home: ev.homeScore.period2 ?? null,
          away: ev.awayScore?.period2 ?? null,
        };
      }
      if (ev.awayScore) {
        snapshot.score.away = ev.awayScore.display ?? ev.awayScore.current ?? snapshot.score.away;
      }
      if (ev.time?.currentPeriodStartTimestamp) {
        snapshot.score.elapsed = Math.floor(
          (Date.now() / 1000 - ev.time.currentPeriodStartTimestamp) / 60,
        );
      }
    } else if (subType === "incidents") {
      const rawIncidents = data.incidents || (Array.isArray(data) ? data : []);
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
          cardType,
          score:
            inc.homeScore !== undefined && inc.awayScore !== undefined
              ? { home: inc.homeScore, away: inc.awayScore }
              : undefined,
          detail: inc.text || inc.incidentClass || inc.description,
        });
      }
      snapshot.incidents = parsed;
    } else if (subType === "stats") {
      const statsList = data.statistics || [];
      const groups: LiveStatGroup[] = [];
      for (const periodGroup of statsList) {
        if (periodGroup.groups) {
          for (const g of periodGroup.groups) {
            groups.push({
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
      if (groups.length > 0) {
        snapshot.stats = groups;
      }
    } else if (subType === "lineups") {
      const homeRaw = data.home || {};
      const awayRaw = data.away || {};

      const parsePlayers = (list: any[]) =>
        (list || []).map((item: any) => ({
          id: item.player?.id || 0,
          name: item.player?.name || "Player",
          shortName: item.player?.shortName,
          number: item.player?.jerseyNumber || "",
          position: item.player?.position,
          substitute: Boolean(item.substitute),
        }));

      const homePlayers = parsePlayers(homeRaw.players);
      const awayPlayers = parsePlayers(awayRaw.players);

      snapshot.lineups = {
        confirmed: Boolean(data.confirmed),
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
    } else if (subType === "odds") {
      const marketsRaw = data.markets || [];
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
      snapshot.odds = parsedMarkets;
    }

    // Notify listeners
    this.broadcast(matchId, snapshot);

    // Persist to DB debounced
    this.persistMatchState(matchId, snapshot);
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
    if (now - last < 10_000) return; // Debounce 10s
    this.lastDbSync.set(matchId, now);

    try {
      const db = await getDb();
      const updateFields: any = {
        updatedAt: new Date(),
      };
      if (snapshot.score.status) updateFields.status = snapshot.score.status;
      if (snapshot.score.home !== null) updateFields.homeGoals = snapshot.score.home;
      if (snapshot.score.away !== null) updateFields.awayGoals = snapshot.score.away;
      if (snapshot.score.elapsed !== null) updateFields.elapsed = snapshot.score.elapsed;

      await db.collection("matches").updateOne(
        { provider: "sportsapi", providerMatchId: matchId },
        { $set: updateFields },
      );
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
