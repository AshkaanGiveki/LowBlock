import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { unstable_cache } from "next/cache";

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

/**
 * Fetches daily fixtures. Cached aggressively to prevent quota consumption.
 */
export const getSportsApiDailyFixtures = unstable_cache(
  async (dateString: string) => {
    // 1. Try /schedule/{dateString} as primary
    try {
      const res = await fetchSportsApi<any>(`/schedule/${dateString}`);
      const events = res.events || res.data || (Array.isArray(res) ? res : null);
      if (Array.isArray(events) && events.length > 0) {
        return { success: true, events };
      }
    } catch (err) {
      console.warn(`[SportsAPI] /schedule/${dateString} failed, falling back:`, err);
    }

    // 2. If it's today, try /today fallback
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateString === todayStr) {
      try {
        const res = await fetchSportsApi<any>("/today");
        const events = res.events || res.data || (Array.isArray(res) ? res : null);
        if (Array.isArray(events) && events.length > 0) {
          return { success: true, events };
        }
      } catch (err) {
        console.warn("[SportsAPI] /today fallback failed:", err);
      }
    }

    return { success: false, events: [] };
  },
  ["sportsapi-daily-fixtures"],
  { revalidate: CACHE_TTL, tags: ["sportsapi"] }
);

/**
 * Fetches specific match details (controlled recovery).
 */
export async function getSportsApiMatchDetails(matchId: number | string) {
  return fetchSportsApi<any>(`/match/${matchId}`);
}
