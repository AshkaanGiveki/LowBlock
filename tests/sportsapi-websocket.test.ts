import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getSportsApiWsManager,
  resetSportsApiWsManager,
} from "@/lib/football/sportsapi/ws";

describe("sportsapi websocket manager", () => {
  let originalWebSocket: any;
  let mockSocketInstances: any[] = [];
  const originalKey = process.env.SPORTSAPI_API_KEY;

  beforeEach(() => {
    mockSocketInstances = [];
    originalWebSocket = globalThis.WebSocket;
    process.env.SPORTSAPI_API_KEY = "test_sportsapi_key";
    resetSportsApiWsManager();

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      public url: string;
      public readyState: number = 0; // CONNECTING
      public onopen: any = null;
      public onmessage: any = null;
      public onclose: any = null;
      public onerror: any = null;
      public sent: string[] = [];

      constructor(url: string) {
        this.url = url;
        mockSocketInstances.push(this);
        setTimeout(() => {
          this.readyState = 1; // OPEN
          if (this.onopen) this.onopen();
        }, 10);
      }

      send(data: string) {
        this.sent.push(data);
      }

      close() {
        this.readyState = 3; // CLOSED
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

  it("manages subscriptions and sends subscribe messages on open", async () => {
    const ws = getSportsApiWsManager();
    ws.subscribeToChannel("live-scores");
    ws.subscribeToChannel("match:12345");

    ws.connect();

    // Wait for mock connection to open
    await new Promise((r) => setTimeout(r, 25));

    const status = ws.getStatus();
    expect(status.connected).toBe(true);
    expect(status.activeSubscriptions).toContain("live-scores");
    expect(status.activeSubscriptions).toContain("match:12345");

    const instance = mockSocketInstances[0];
    expect(instance.sent).toContain(
      JSON.stringify({ action: "subscribe", channel: "live-scores" }),
    );
    expect(instance.sent).toContain(
      JSON.stringify({ action: "subscribe", channel: "match:12345" }),
    );
  });

  it("dispatches messages to registered listeners", async () => {
    const ws = getSportsApiWsManager();
    const received: any[] = [];
    const callback = (channel: string, data: any) => {
      received.push({ channel, data });
    };

    ws.addListener(callback);
    ws.connect();
    await new Promise((r) => setTimeout(r, 25));

    const instance = mockSocketInstances[0];
    instance.onmessage({
      data: JSON.stringify({
        channel: "live-scores",
        eventId: 17166285,
        homeScore: { current: 3 },
      }),
    });

    expect(received.length).toBe(1);
    expect(received[0].channel).toBe("live-scores");
    expect(received[0].data.eventId).toBe(17166285);

    ws.removeListener(callback);
  });

  it("handles unsubscribe requests", async () => {
    const ws = getSportsApiWsManager();
    ws.subscribeToChannel("match:999");
    ws.connect();
    await new Promise((r) => setTimeout(r, 25));

    ws.unsubscribeFromChannel("match:999");
    const instance = mockSocketInstances[0];
    expect(instance.sent).toContain(
      JSON.stringify({ action: "unsubscribe", channel: "match:999" }),
    );
    expect(ws.getStatus().activeSubscriptions).not.toContain("match:999");
  });
});
