import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";

export type SportsApiRestResponse<T> = {
  success?: boolean;
  events?: T[];
  data?: T[];
  tournaments?: number;
  totalTournamentsOnDate?: number;
  error?: { code: number; message: string };
};

const CACHE_TTL = env.SPORTSAPI_DAILY_DISCOVERY_CACHE_TTL || 300; // default 5 mins

/**
 * Tracks API requests in MongoDB for observability and quota management.
 */
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
    });
  } catch (err) {
    console.error("[SportsAPI] Failed to track request:", err);
  }
}

/**
 * Core REST fetcher with multi-endpoint fallback, timeout, and quota logging.
 */
export async function fetchSportsApi<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<SportsApiRestResponse<T>> {
  const apiKey = env.SPORTSAPI_API_KEY || process.env.SPORTSAPI_API_KEY;
  if (!apiKey) {
    console.error("[SportsAPI] CRITICAL: SPORTSAPI_API_KEY is not configured in environment variables!");
    return {
      success: false,
      events: [],
      error: { code: 401, message: "SPORTSAPI_API_KEY is not configured" },
    };
  }

  const candidatePaths = [
    path,
    path.startsWith("/api/") ? path.replace("/api/", "/") : `/api${path}`,
  ];

  let lastError: Error | null = null;
  const start = performance.now();

  for (const candidatePath of candidatePaths) {
    const url = new URL(`${env.SPORTSAPI_BASE_URL}${candidatePath}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
        next: { revalidate: 0 },
      });

      const duration = performance.now() - start;

      if (response.status === 404 && candidatePath !== candidatePaths.at(-1)) {
        // Try the alternative path
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        await trackRequest(candidatePath, params, duration, "FAILED", `HTTP ${response.status}: ${text}`);
        if (response.status === 404) continue;
        throw new Error(`SportsAPI HTTP ${response.status}: ${text}`);
      }

      const body = await response.json();

      // Check if body represents an explicit error
      if (body && body.success === false && body.error && !body.events && !body.data) {
        await trackRequest(candidatePath, params, duration, "FAILED", JSON.stringify(body.error));
        throw new Error(`SportsAPI Error: ${JSON.stringify(body.error)}`);
      }

      await trackRequest(candidatePath, params, duration, "OK");
      return body as SportsApiRestResponse<T>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  const totalDuration = performance.now() - start;
  await trackRequest(path, params, totalDuration, "FAILED", lastError?.message || "Unknown error");
  console.error(`[SportsAPI] All endpoint variants failed for ${path}:`, lastError?.message);
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
