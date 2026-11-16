/**
 * Optional shared Upstash Redis REST cache. No Redis credentials means a
 * predictable MongoDB-only fallback. Only the dedicated worker writes.
 * This cache never contacts SportsAPI and never contains prediction/user data.
 */
const prefix = "lowblock:match-intelligence:live:";
const timeoutMs = 1500;

function settings() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !/^https:\/\//.test(url)) return null;
  return { url, token };
}

type LiveCachePayload = {
  provider: "sportsapi";
  score: unknown;
  incidents: unknown[];
  stats: unknown[];
  lineups: unknown | null;
  updatedAt: string;
};

async function command(args: Array<string | number>): Promise<any> {
  const config = settings();
  if (!config) return null;
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error("Redis status " + response.status);
  const json = await response.json();
  if (json?.error) throw new Error("Redis rejected command");
  return json?.result ?? null;
}

export async function readCachedLiveMatch(matchId: string): Promise<LiveCachePayload | null> {
  if (!settings() || !/^[a-zA-Z0-9_-]{1,80}$/.test(matchId)) return null;
  try {
    const data = await command(["GET", prefix + matchId]);
    if (typeof data !== "string") return null;
    const parsed = JSON.parse(data);
    return parsed?.provider === "sportsapi" ? parsed as LiveCachePayload : null;
  } catch {
    // Redis outages must not make the match screen unavailable.
    return null;
  }
}

export async function writeCachedLiveMatch(
  matchId: string,
  snapshot: {
    score: unknown;
    incidents: unknown[];
    stats: unknown[];
    lineups: unknown | null;
  },
): Promise<void> {
  if (!settings() || !/^[a-zA-Z0-9_-]{1,80}$/.test(matchId)) return;
  try {
    const value: LiveCachePayload = {
      provider: "sportsapi",
      score: snapshot.score,
      incidents: snapshot.incidents,
      stats: snapshot.stats,
      lineups: snapshot.lineups,
      updatedAt: new Date().toISOString(),
    };
    // Short TTL prevents displaying indefinitely stale worker snapshots.
    await command(["SET", prefix + matchId, JSON.stringify(value), "EX", 180]);
  } catch {
    // Mongo persists verified match history and remains the fallback.
  }
}
