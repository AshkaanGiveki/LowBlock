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

export type SportsApiQuota = {
  used: number;
  limit: number | null;
  remaining: number | null;
  source: "provider-header" | "configured-limit" | "usage-only";
  day: string;
};

const CACHE_TTL = env.SPORTSAPI_DAILY_DISCOVERY_CACHE_TTL || 300; // default 5 mins
const DISCOVERY_CACHE_TTL_MS = env.SPORTSAPI_TOURNAMENT_DISCOVERY_ENABLED
  ? CACHE_TTL * 1000
  : Math.max(CACHE_TTL, 86_400) * 1000;

async function trackRequest(
  path: string,
  params: Record<string, string>,
  durationMs: number,
  status: "OK" | "FAILED",
  error?: string,
  quota?: { remaining?: number; limit?: number },
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
      via: "rest",
      quotaRemaining: quota?.remaining,
      quotaLimit: quota?.limit,
    });
  } catch (err) {
    console.error("[SportsAPI] Failed to track request:", err);
  }
}

/**
 * REST is the source for discovery and on-demand resources. The provider's
 * documented WebSocket surface is a realtime stream, not a REST proxy.
 */
export async function fetchSportsApi<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<SportsApiRestResponse<T>> {
  const startedAt = performance.now();
  const url = new URL(`${env.SPORTSAPI_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  try {
    const response = await fetch(url, {
      headers: { "x-api-key": env.SPORTSAPI_API_KEY || "" },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => null)) as SportsApiRestResponse<T> | null;
    const remaining = firstHeader(response.headers, ["x-ratelimit-remaining", "x-rate-limit-remaining", "x-requests-remaining", "x-quota-remaining"]);
    const limit = firstHeader(response.headers, ["x-ratelimit-limit", "x-rate-limit-limit", "x-requests-limit", "x-quota-limit"]);
    const quota = { ...(remaining == null ? {} : { remaining }), ...(limit == null ? {} : { limit }) };
    if (!response.ok || !body) {
      const message = body?.error?.message || `SportsAPI REST request failed (${response.status})`;
      await trackRequest(path, params, performance.now() - startedAt, "FAILED", message, quota);
      return { success: false, events: [], error: { code: response.status, message } };
    }
    await trackRequest(path, params, performance.now() - startedAt, "OK", undefined, quota);
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await trackRequest(path, params, performance.now() - startedAt, "FAILED", message);
    return { success: false, events: [], error: { code: 500, message } };
  }
}

function firstHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value != null && /^\d+$/.test(value.trim())) return Number(value.trim());
  }
  return undefined;
}

export async function getSportsApiQuota(): Promise<SportsApiQuota> {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.APP_TIMEZONE || "Asia/Tehran",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const start = new Date(`${day}T00:00:00+03:30`);
  const db = await getDb();
  const used = await db.collection<any>("sportsApiRequests").countDocuments({
    timestamp: { $gte: start, $lt: new Date(start.getTime() + 86_400_000) },
  });
  const latest = await db.collection<any>("sportsApiRequests").findOne(
    { timestamp: { $gte: start } },
    { sort: { timestamp: -1 }, projection: { quotaRemaining: 1, quotaLimit: 1 } },
  );
  const limit = latest?.quotaLimit ?? env.SPORTSAPI_DAILY_LIMIT ?? null;
  const remaining = latest?.quotaRemaining ?? (limit == null ? null : Math.max(0, limit - used));
  return { used, limit, remaining, source: latest?.quotaRemaining != null ? "provider-header" : limit == null ? "usage-only" : "configured-limit", day };
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

  // Persist the discovery cache so a restart or a second app instance does
  // not spend another four REST calls against the Free-plan quota.
  try {
    const db = await getDb();
    const persisted = await db.collection<any>("sportsApiDailyFixtures").findOne({ dateString });
    if (persisted?.expiresAt && new Date(persisted.expiresAt).getTime() > now && persisted.data) {
      dailyFixturesCache.set(dateString, {
        data: persisted.data,
        expiresAt: new Date(persisted.expiresAt).getTime(),
      });
      return persisted.data;
    }
  } catch (err) {
    console.warn("[SportsAPI] Persistent discovery cache unavailable:", err);
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
      expiresAt: now + DISCOVERY_CACHE_TTL_MS,
    });
    try {
      const db = await getDb();
      await db.collection("sportsApiDailyFixtures").updateOne(
        { dateString },
        {
          $set: {
            dateString,
            data: result,
            expiresAt: new Date(now + DISCOVERY_CACHE_TTL_MS),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      console.warn("[SportsAPI] Failed to persist discovery cache:", err);
    }
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


