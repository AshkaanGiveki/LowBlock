import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { getSportsApiWsManager } from "./ws";
import crypto from "crypto";

export type SportsApiRestResponse<T> = {
  success?: boolean;
  events?: T[];
  data?: T[];
  tournaments?: number;
  totalTournamentsOnDate?: number;
  error?: { code: number; message: string };
};

const CACHE_TTL = env.SPORTSAPI_DAILY_DISCOVERY_CACHE_TTL || 300; // default 5 mins

async function trackRequest(
  path: string,
  params: Record<string, string>,
  durationMs: number,
  status: "OK" | "FAILED",
  error?: string,
) {
  try {
    const db = await getDb();
    await db.collection("sportsApiRequests").insertOne({
      path,
      params,
      durationMs,
      status,
      error,
      timestamp: new Date(),
      via: "websocket"
    });
  } catch (err) {
    console.error("[SportsAPI] Failed to track request:", err);
  }
}

/**
 * Core fetcher rebuilt to use WebSockets exclusively to avoid HTTP 429 rate limits.
 */
export async function fetchSportsApi<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<SportsApiRestResponse<T>> {
  const wsManager = getSportsApiWsManager();
  
  if (!wsManager.getStatus().connected) {
    wsManager.connect();
  }

  const candidatePaths = [
    path,
    path.startsWith("/api/") ? path.replace("/api/", "/") : `/api${path}`,
  ];

  let lastError: Error | null = null;
  const start = performance.now();

  for (const candidatePath of candidatePaths) {
    const requestId = crypto.randomUUID();
    
    // We create a promise that resolves when the WS sends back a message with this requestId
    try {
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          wsManager.removeListener(listener);
          reject(new Error("WebSocket request timeout"));
        }, 15000);

        const listener = (channel: string, payload: any) => {
          if (payload.requestId === requestId) {
            clearTimeout(timeout);
            wsManager.removeListener(listener);
            resolve(payload.data || payload);
          }
        };

        wsManager.addListener(listener);

        // Ensure connected before sending
        if (!wsManager.getStatus().connected) {
           wsManager.connect();
           // Small wait to allow connection
           setTimeout(() => {
             wsManager.sendRequest({
                action: "request",
                path: candidatePath,
                params,
                requestId
             });
           }, 1000);
        } else {
           wsManager.sendRequest({
              action: "request",
              path: candidatePath,
              params,
              requestId
           });
        }
      });

      const duration = performance.now() - start;

      if (response && response.success === false && response.error && response.error.code === 404 && candidatePath !== candidatePaths.at(-1)) {
        continue; // Try next path
      }

      if (response && response.success === false && response.error) {
        await trackRequest(candidatePath, params, duration, "FAILED", JSON.stringify(response.error));
        if (response.error.code === 404) continue;
        throw new Error(`SportsAPI WS Error: ${JSON.stringify(response.error)}`);
      }

      await trackRequest(candidatePath, params, duration, "OK");
      return response as SportsApiRestResponse<T>;

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  const totalDuration = performance.now() - start;
  await trackRequest(path, params, totalDuration, "FAILED", lastError?.message || "Unknown error");
  console.error(`[SportsAPI WS] All endpoint variants failed for ${path}:`, lastError?.message);
  return { success: false, events: [], error: { code: 500, message: lastError?.message || "Failed request" } };
}

// In-memory cache for daily discovery to support all execution environments
const dailyFixturesCache = new Map<
  string,
  { data: SportsApiRestResponse<any>; expiresAt: number }
>();

/**
 * Fetches daily fixtures. Cached in-memory to prevent quota consumption.
 * Merges /today with /schedule to guarantee all 800+ matches across all tournaments are captured.
 */
export async function getSportsApiDailyFixtures(
  dateString: string,
): Promise<SportsApiRestResponse<any>> {
  const now = Date.now();
  const cached = dailyFixturesCache.get(dateString);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const eventsMap = new Map<number | string, any>();
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = dateString === todayStr;

  // 1. If today, fetch /today first (returns full 800+ matches across all tournaments)
  if (isToday) {
    try {
      const res = await fetchSportsApi<any>("/today");
      const events = res.events || res.data || (Array.isArray(res) ? res : null);
      if (Array.isArray(events)) {
        for (const ev of events) {
          const id = ev.id || ev.eventId;
          if (id) eventsMap.set(id, ev);
        }
      }
    } catch (err) {
      console.warn("[SportsAPI] /today query failed:", err);
    }
  }

  // 2. Fetch /schedule/{dateString}
  try {
    const res = await fetchSportsApi<any>(`/schedule/${dateString}`);
    const events = res.events || res.data || (Array.isArray(res) ? res : null);
    if (Array.isArray(events)) {
      for (const ev of events) {
        const id = ev.id || ev.eventId;
        if (id && !eventsMap.has(id)) {
          eventsMap.set(id, ev);
        }
      }
    }
  } catch (err) {
    console.warn(`[SportsAPI] /schedule/${dateString} failed:`, err);
  }

  const allEvents = Array.from(eventsMap.values());
  if (allEvents.length > 0) {
    const result = { success: true, events: allEvents };
    dailyFixturesCache.set(dateString, {
      data: result,
      expiresAt: now + CACHE_TTL * 1000,
    });
    return result;
  }

  return { success: false, events: [] };
}

/**
 * Fetches tournament seasons list to identify the current active season.
 */
export async function getSportsApiTournamentSeasons(tournamentId: number | string) {
  return fetchSportsApi<any>(`/tournaments/${tournamentId}/seasons`);
}

/**
 * Fetches tournament events (next upcoming or last finished) for a specific season.
 */
export async function getSportsApiTournamentEvents(
  tournamentId: number | string,
  seasonId: number | string,
  type: "next" | "last" = "next",
  page = 0,
) {
  return fetchSportsApi<any>(`/tournament/${tournamentId}/season/${seasonId}/events/${type}/${page}`);
}

/**
 * Fetches all currently active live matches.
 */
export async function getSportsApiLiveMatches() {
  return fetchSportsApi<any>("/live");
}

/**
 * Fetches specific match details (controlled recovery).
 */
export async function getSportsApiMatchDetails(matchId: number | string) {
  return fetchSportsApi<any>(`/match/${matchId}`);
}
