import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  getMatchMonitorService,
} from "@/lib/football/sportsapi/matchMonitor";
import {
  getSportsApiWsManager,
  resetSportsApiWsManager,
} from "@/lib/football/sportsapi/ws";

describe("sportsapi match monitor and background handlers", () => {
  let originalWebSocket: any;
  let mockSocketInstances: any[] = [];
  const originalKey = process.env.SPORTSAPI_API_KEY;

  beforeEach(() => {
    mockSocketInstances = [];
    originalWebSocket = globalThis.WebSocket;
    process.env.SPORTSAPI_API_KEY = "test_key";
    resetSportsApiWsManager();

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      public readyState: number = 0;
      public onopen: any = null;
      public onmessage: any = null;
      public onclose: any = null;
      public onerror: any = null;
      public sent: string[] = [];

      constructor() {
        mockSocketInstances.push(this);
        setTimeout(() => {
          this.readyState = 1;
          if (this.onopen) this.onopen();
        }, 10);
      }

      send(data: string) {
        this.sent.push(data);
      }

      close() {
        this.readyState = 3;
        if (this.onclose) this.onclose();
      }
    }

    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    process.env.SPORTSAPI_API_KEY = originalKey;
    resetSportsApiWsManager();
  });

  it("updates lineups snapshot on match:ID:lineups message", async () => {
    const monitor = getMatchMonitorService();
    const matchId = "99001";

    monitor.handleWsMessage(`match:${matchId}:lineups`, {
      data: {
        confirmed: true,
        home: {
          formation: "4-3-3",
          players: [
            { player: { id: 1, name: "Goalkeeper" }, substitute: false, jerseyNumber: "1" },
            { player: { id: 2, name: "Sub Striker" }, substitute: true, jerseyNumber: "19" },
          ],
        },
        away: {
          formation: "4-4-2",
          players: [
            { player: { id: 3, name: "Defender" }, substitute: false, jerseyNumber: "4" },
          ],
        },
      },
    });

    const snap = monitor.getSnapshot(matchId);
    expect(snap.lineups).not.toBeNull();
    expect(snap.lineups?.confirmed).toBe(true);
    expect(snap.lineups?.home.formation).toBe("4-3-3");
    expect(snap.lineups?.home.players.length).toBe(1);
    expect(snap.lineups?.home.substitutes.length).toBe(1);
    expect(snap.lineups?.away.players.length).toBe(1);
  });

  it("updates statistics snapshot on match:ID:stats message", async () => {
    const monitor = getMatchMonitorService();
    const matchId = "99002";

    monitor.handleWsMessage(`match:${matchId}:stats`, {
      data: {
        statistics: [
          {
            groups: [
              {
                groupName: "Possession",
                statisticsItems: [
                  { name: "Ball Possession", home: "60%", away: "40%", homeValue: 60, awayValue: 40 },
                ],
              },
            ],
          },
        ],
      },
    });

    const snap = monitor.getSnapshot(matchId);
    expect(snap.stats.length).toBe(1);
    expect(snap.stats[0].groupName).toBe("Possession");
    expect(snap.stats[0].items[0].homeValue).toBe(60);
  });

  it("updates incidents snapshot on match:ID:incidents message", async () => {
    const monitor = getMatchMonitorService();
    const matchId = "99003";

    monitor.handleWsMessage(`match:${matchId}:incidents`, {
      data: {
        incidents: [
          {
            id: 101,
            incidentType: "goal",
            time: 24,
            isHome: true,
            player: { name: "Lionel Messi" },
            assist1: { name: "Andres Iniesta" },
            homeScore: 1,
            awayScore: 0,
          },
        ],
      },
    });

    const snap = monitor.getSnapshot(matchId);
    expect(snap.incidents.length).toBe(1);
    expect(snap.incidents[0].type).toBe("goal");
    expect(snap.incidents[0].playerName).toBe("Lionel Messi");
    expect(snap.incidents[0].assistName).toBe("Andres Iniesta");
    expect(snap.incidents[0].score).toEqual({ home: 1, away: 0 });
  });

  it("updates score and status from live-scores message", async () => {
    const monitor = getMatchMonitorService();
    const matchId = "99004";

    monitor.handleWsMessage("live-scores", {
      event: {
        id: matchId,
        status: { type: "inprogress", description: "1st half" },
        homeScore: { display: 2, current: 2 },
        awayScore: { display: 1, current: 1 },
      },
    });

    const snap = monitor.getSnapshot(matchId);
    expect(snap.score.status).toBe("LIVE");
    expect(snap.score.home).toBe(2);
    expect(snap.score.away).toBe(1);
    expect(snap.score.statusDescription).toBe("1st half");
  });

  it("reconciles SportsAPI flattened live-score deltas", () => {
    const monitor = getMatchMonitorService();

    monitor.handleWsMessage("live-scores", {
      type: "update",
      data: {
        eventId: "99005",
        id: "99005",
        "status.code": 6,
        "status.description": "2nd half",
        "status.type": "inprogress",
        "homeScore.current": 2,
        "awayScore.current": 1,
        "changes.changeTimestamp": 1234567890,
      },
    });

    const snap = monitor.getSnapshot("99005");
    expect(snap.score.status).toBe("LIVE");
    expect(snap.score.home).toBe(2);
    expect(snap.score.away).toBe(1);
    expect(snap.score.statusDescription).toBe("2nd half");
  });

  it("accepts nested live-score event batches and keeps a visible live clock", () => {
    const monitor = getMatchMonitorService();

    monitor.handleWsMessage("live-scores:football", {
      data: {
        events: [
          {
            eventId: "99006",
            status: { type: "inprogress", description: "1st half" },
            homeScore: 0,
            awayScore: 0,
          },
        ],
      },
    });

    const snap = monitor.getSnapshot("99006");
    expect(snap.score.status).toBe("LIVE");
    expect(snap.score.home).toBe(0);
    expect(snap.score.away).toBe(0);
    expect(snap.score.elapsed).toBe(1);
  });
});
