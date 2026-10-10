import { env } from "@/lib/env";

export type WsMessageCallback = (channel: string, data: any) => void;

export class SportsApiWebSocketManager {
  private ws: WebSocket | null = null;
  private activeSubscriptions = new Set<string>();
  private reconnectAttempts = 0;
  private listeners: WsMessageCallback[] = [];
  private isConnecting = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private manualDisconnect = false;

  constructor() {}

  public getStatus() {
    return {
      connected: this.ws !== null && this.ws.readyState === 1,
      activeSubscriptions: Array.from(this.activeSubscriptions),
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  public subscribeToChannel(channel: string) {
    this.activeSubscriptions.add(channel);
    if (this.ws !== null && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ action: "subscribe", channel }));
    }
  }

  public unsubscribeFromChannel(channel: string) {
    this.activeSubscriptions.delete(channel);
    if (this.ws !== null && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ action: "unsubscribe", channel }));
    }
  }

  public addListener(cb: WsMessageCallback) {
    this.listeners.push(cb);
  }

  public removeListener(cb: WsMessageCallback) {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }

  public sendRequest(payload: any) {
    if (this.ws !== null && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public connect() {
    if (!isSportsApiRealtimeEnabled()) return;
    const apiKey = env.SPORTSAPI_API_KEY || process.env.SPORTSAPI_API_KEY;
    if (!apiKey) return;
    if ((this.ws !== null && this.ws.readyState === 1) || this.isConnecting) return;

    this.manualDisconnect = false;
    this.isConnecting = true;

    const url = `${env.SPORTSAPI_WS_URL}?x-api-key=${apiKey}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Restore subscriptions
        for (const channel of this.activeSubscriptions) {
          if (this.ws !== null && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ action: "subscribe", channel }));
          }
        }

        // Setup ping every 30s to keep connection alive
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws !== null && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ action: "ping" }));
          }
        }, 30000);
        this.pingInterval.unref?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (
            payload.action === "pong" ||
            payload.event === "pong" ||
            payload.type === "welcome" ||
            payload.type === "subscribed"
          ) {
            return;
          }

          const channel = payload.channel || "live-scores";

          for (const listener of this.listeners) {
            listener(channel, payload);
          }
        } catch (err) {
          console.error("[SportsAPI WS] Parse Error:", err);
        }
      };

      this.ws.onclose = () => {
        this.cleanup();
        if (!this.manualDisconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error("[SportsAPI WS] Error:", err);
        this.ws?.close();
      };
    } catch (err) {
      console.error("[SportsAPI WS] Init Error:", err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.manualDisconnect = true;
    this.cleanup();
  }

  private cleanup() {
    this.isConnecting = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === 1) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.manualDisconnect) return;

    const delay = Math.min(
      env.SPORTSAPI_RECONNECT_INITIAL_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      env.SPORTSAPI_RECONNECT_MAX_DELAY_MS,
    );

    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect();
    }, delay);
  }
}

/**
 * Realtime is intentionally disabled on Vercel unless explicitly enabled.
 * Long-lived WebSocket connections are multiplied across serverless
 * instances and can exhaust the MongoDB connection/pool budget.
 */
export function isSportsApiRealtimeEnabled(): boolean {
  return process.env.VERCEL !== "1" || process.env.SPORTSAPI_REALTIME_ENABLED === "true";
}

// Global singleton for server/client contexts
const globalForWs = globalThis as unknown as {
  sportsApiWsManager?: SportsApiWebSocketManager;
};

export const getSportsApiWsManager = () => {
  if (!globalForWs.sportsApiWsManager) {
    globalForWs.sportsApiWsManager = new SportsApiWebSocketManager();
  }
  return globalForWs.sportsApiWsManager;
};

export const resetSportsApiWsManager = () => {
  if (globalForWs.sportsApiWsManager) {
    globalForWs.sportsApiWsManager.disconnect();
    globalForWs.sportsApiWsManager = undefined;
  }
};
