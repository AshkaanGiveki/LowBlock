import { env } from "@/lib/env";
import { providerDayBounds } from "../scheduleWindow";
import { getDb } from "@/lib/db/mongo";
import { appDateKey } from "../scheduleWindow";

export type SportsApiRestResponse<T> = {
  success?: boolean;
  events?: T[];
  data?: T[];
  tournaments?: number;
  totalTournamentsOnDate?: number;
  error?: { code: number; message: string };
};

export type SportsApiDiscoveryManifest = {
  dateString: string;
  status: "COMPLETE" | "INCOMPLETE";
  attempts: number;
  schedule: { ok: boolean; count: number; tournamentCount: number; error?: string };
  today: { attempted: boolean; ok: boolean; count: number; tournamentCount: number; error?: string };
  mergedCount: number;
  mergedTournamentCount: number;
  missingEventIds: number;
  checkedAt: Date;
};

export type SportsApiQuota = {
  used: number;
  limit: number | null;
  remaining: number | null;
  source: "provider-header" | "configured-limit" | "usage-only";
  day: string;
};

const CACHE_TTL = env.SPORTSAPI_DAILY_DISCOVERY_CACHE_TTL || 300; // default 5 mins
// The daily sync intentionally reads each of yesterday, today, and tomorrow
// once per short cache window. This prevents the page, cron, and Telegram
// paths from multiplying the same REST request while still allowing a manual
// retry shortly after a provider outage.
const DISCOVERY_CACHE_TTL_MS = CACHE_TTL * 1000;

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

  // Fail closed before making a provider request once the configured daily
  // budget is exhausted. This counts all attempted REST calls, including
  // failed calls, and prevents optional paths from consuming the free quota.
  try {
    const db = await getDb();
    // SportsAPI resets quota at 00:00 UTC. Using Tehran midnight here
    // incorrectly carried pre-reset usage into the new provider day.
    const { start } = providerDayBounds();
    const used = await db.collection("sportsApiRequests").countDocuments({
      timestamp: { $gte: start },
    });
    if (used >= env.SPORTSAPI_DAILY_REQUEST_BUDGET) {
      return {
        success: false,
        events: [],
        error: {
          code: 429,
          message: `SportsAPI local daily request budget exhausted (${used}/${env.SPORTSAPI_DAILY_REQUEST_BUDGET})`,
        },
      };
    }
  } catch (error) {
    console.error("[SportsAPI] Could not verify local request budget:", error);
    return {
      success: false,
      events: [],
      error: { code: 503, message: "SportsAPI local request budget unavailable" },
    };
  }

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
  const day = new Date().toISOString().slice(0, 10);
  const { start, end } = providerDayBounds();
  const db = await getDb();
  const used = await db.collection<any>("sportsApiRequests").countDocuments({
    timestamp: { $gte: start, $lt: end },
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
 * Fetches one calendar day's fixtures through the provider REST API.
 *
 * The scheduled sync deliberately uses one `/schedule/{date}` request per
 * date. The WebSocket remains responsible for realtime deltas; REST is the
 * authoritative daily snapshot/discovery path. Keeping this function to one
 * request per date makes the normal yesterday/today/tomorrow sync three
 * provider calls at most.
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
  // not spend another request for the same date within the cache window.
  try {
    const db = await getDb();
    const persisted = await db.collection<any>("sportsApiDailyFixtures").findOne({ dateString });
    if (
      persisted?.expiresAt &&
      new Date(persisted.expiresAt).getTime() > now &&
      persisted.data
    ) {
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
  let result: SportsApiRestResponse<any> = {
    success: true,
    events: [],
  };

  // One request per requested date. Do not add a second /today request here:
  // the daily window is deliberately capped at three REST calls.
  try {
    const res = await fetchSportsApi<any>(`/schedule/${dateString}`);
    if (res.success === false || res.error) {
      return {
        success: false,
        events: [],
        error: res.error ?? { code: 502, message: "SportsAPI returned an unsuccessful response" },
      };
    }
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
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[SportsAPI] /schedule/${dateString} failed:`, message);
    result = { success: false, events: [], error: { code: 500, message } };
  }

  if (result.success !== false)
    result = { success: true, events: Array.from(eventsMap.values()) };
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

function eventList(response: SportsApiRestResponse<any>) {
  const value = response.events || response.data || (Array.isArray(response) ? response : []);
  return Array.isArray(value) ? value : [];
}

function eventTournamentKey(event: any) {
  return String(event?.tournament?.uniqueTournament?.id ?? event?.tournament?.id ?? event?.uniqueTournament?.id ?? event?.tournamentId ?? "");
}

/** Discovers and audits every date in a week before H2H slate generation. */
export async function discoverSportsApiWeek(dateStrings: string[], options: { attempts?: number; reuseComplete?: boolean } = {}) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const todayStr = appDateKey();
  const allEvents = new Map<string, any>();
  const manifests: SportsApiDiscoveryManifest[] = [];

  for (const dateString of [...new Set(dateStrings)]) {
    const db = await getDb();
    const persisted = await db.collection<any>("sportsApiDiscoveryManifests").findOne({ kind: "daily", dateString, status: "COMPLETE", "data.events": { $exists: true } });
    const persistedAt = persisted?.checkedAt ? new Date(persisted.checkedAt).getTime() : 0;
    const reusableManifest =
      (options.reuseComplete || dateString > todayStr) &&
      persistedAt > 0 &&
      Date.now() - persistedAt < DISCOVERY_CACHE_TTL_MS &&
      Array.isArray(persisted?.data?.events);
    if (reusableManifest) {
      for (const event of persisted.data.events) {
        const id = String(event?.id ?? event?.eventId ?? "");
        if (id) allEvents.set(id, event);
      }
      manifests.push(persisted as SportsApiDiscoveryManifest);
      continue;
    }
    let finalManifest: SportsApiDiscoveryManifest | null = null;
    let selectedEvents: any[] = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const schedule = await fetchSportsApi<any>(`/schedule/${dateString}`);
      const scheduleEvents = eventList(schedule);
      const todayAttempted = dateString === todayStr;
      const today = todayAttempted ? await fetchSportsApi<any>("/today") : null;
      const todayEvents = today ? eventList(today) : [];
      const scheduleIds = new Set(scheduleEvents.map((event) => String(event?.id ?? event?.eventId ?? "")).filter(Boolean));
      const merged = [...scheduleEvents, ...todayEvents].filter((event, index, rows) => {
        const id = String(event?.id ?? event?.eventId ?? "");
        return id && rows.findIndex((other) => String(other?.id ?? other?.eventId ?? "") === id) === index;
      });
      const current: SportsApiDiscoveryManifest = {
        dateString,
        status: schedule.success !== false && (!todayAttempted || today?.success !== false) ? "COMPLETE" : "INCOMPLETE",
        attempts: attempt,
        schedule: { ok: schedule.success !== false, count: scheduleEvents.length, tournamentCount: new Set(scheduleEvents.map(eventTournamentKey).filter(Boolean)).size, error: schedule.error?.message },
        today: { attempted: todayAttempted, ok: !todayAttempted || today?.success !== false, count: todayEvents.length, tournamentCount: new Set(todayEvents.map(eventTournamentKey).filter(Boolean)).size, error: today?.error?.message },
        mergedCount: merged.length,
        mergedTournamentCount: new Set(merged.map(eventTournamentKey).filter(Boolean)).size,
        missingEventIds: todayAttempted ? todayEvents.filter((event) => !scheduleIds.has(String(event?.id ?? event?.eventId ?? ""))).length : 0,
        checkedAt: new Date(),
      };
      finalManifest = current;
      if (current.status === "COMPLETE") {
        selectedEvents = merged;
        break;
      }
      // Preserve whatever the provider did return. An incomplete day must not
      // block scoring the complete days, and the next run can retry the gap.
      if (merged.length) selectedEvents = merged;
      if (schedule.error?.code === 429 || today?.error?.code === 429) break;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
    manifests.push(finalManifest!);
    for (const event of selectedEvents) {
      const id = String(event?.id ?? event?.eventId ?? "");
      if (id) allEvents.set(id, event);
    }
    await db.collection("sportsApiDiscoveryManifests").updateOne({ kind: "daily", dateString }, { $set: { kind: "daily", ...finalManifest, data: selectedEvents.length ? { success: true, events: selectedEvents } : undefined, updatedAt: new Date() } }, { upsert: true });
  }

  const dates = [...new Set(dateStrings)];
  const complete = manifests.length === dates.length && manifests.every((item) => item.status === "COMPLETE");
  const db = await getDb();
  await db.collection("sportsApiDiscoveryManifests").updateOne({ kind: "weekly", dates }, { $set: { kind: "weekly", dates, status: complete ? "COMPLETE" : "INCOMPLETE", manifests, checkedAt: new Date() } }, { upsert: true });
  return { complete, events: Array.from(allEvents.values()), manifests };
}

/** Rebuilds the weekly manifest from persisted daily manifests without API calls. */
export async function finalizeSportsApiWeek(dateStrings: string[]) {
  const dates = [...new Set(dateStrings)];
  const db = await getDb();
  const manifests = await db.collection<any>("sportsApiDiscoveryManifests").find({
    kind: "daily",
    dateString: { $in: dates },
  }).toArray();
  const byDate = new Map(manifests.map((manifest) => [String(manifest.dateString), manifest]));
  const ordered = dates.map((dateString) => byDate.get(dateString)).filter(Boolean) as SportsApiDiscoveryManifest[];
  const complete = ordered.length === dates.length && ordered.every((manifest) => manifest.status === "COMPLETE");
  await db.collection("sportsApiDiscoveryManifests").updateOne(
    { kind: "weekly", dates },
    { $set: { kind: "weekly", dates, status: complete ? "COMPLETE" : "INCOMPLETE", manifests: ordered, checkedAt: new Date() } },
    { upsert: true },
  );
  return { complete, manifests: ordered };
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


