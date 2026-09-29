import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { unstable_cache } from "next/cache";

type SportsApiRestResponse<T> = {
  success: boolean;
  events?: T[];
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
    console.error("Failed to track SportsAPI request:", err);
  }
}

/**
 * Core REST fetcher with timeout and logging.
 */
async function fetchSportsApi<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<SportsApiRestResponse<T>> {
  if (!env.SPORTSAPI_API_KEY) {
    throw new Error("SPORTSAPI_API_KEY is not configured");
  }

  const url = new URL(`${env.SPORTSAPI_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const start = performance.now();
  try {
    const response = await fetch(url.toString(), {
      headers: { "x-api-key": env.SPORTSAPI_API_KEY },
      // Use no-store here because we'll handle caching explicitly via unstable_cache or DB
      cache: "no-store",
      next: { revalidate: 0 },
    });

    const duration = performance.now() - start;
    const body = await response.json();

    if (!response.ok || !body.success) {
      await trackRequest(path, params, duration, "FAILED", JSON.stringify(body.error || body));
      throw new Error(`SportsAPI Error ${response.status}: ${JSON.stringify(body.error || body)}`);
    }

    await trackRequest(path, params, duration, "OK");
    return body as SportsApiRestResponse<T>;
  } catch (error) {
    const duration = performance.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    await trackRequest(path, params, duration, "FAILED", msg);
    throw error;
  }
}

/**
 * Fetches daily fixtures. Cached aggressively to prevent quota consumption.
 */
export const getSportsApiDailyFixtures = unstable_cache(
  async (dateString: string) => {
    // Check if it's today
    const todayStr = new Date().toISOString().slice(0, 10);
    const path = dateString === todayStr ? "/today" : `/schedule/${dateString}`;
    return fetchSportsApi<any>(path);
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
