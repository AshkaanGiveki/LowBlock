import dns from "node:dns";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { providerDayBounds } from "../scheduleWindow";
import { getDb } from "@/lib/db/mongo";
import { appDateKey } from "../scheduleWindow";

// The production host intermittently prefers an unreachable IPv6 route for
// api.sportsapipro.com. Prefer IPv4 so the scheduled worker does not spend
// its entire retry window waiting for connection timeouts.
dns.setDefaultResultOrder("ipv4first");

export type SportsApiRestResponse<T> = {
  success?: boolean;
  events?: T[];
  data?: T[];
  tournaments?: number;
  totalTournamentsOnDate?: number;
  page?: number;
  totalPages?: number;
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
// Keep request accounting isolated when operations rotate the provider key.
// This is a one-way fingerprint and never stores the API key itself.
const requestKeyFingerprint = () => createHash("sha256").update(env.SPORTSAPI_API_KEY || "missing").digest("hex").slice(0, 16);
const SPORTSAPI_REQUEST_TIMEOUT_MS = Math.max(
  15_000,
  Number(process.env.SPORTSAPI_REQUEST_TIMEOUT_MS || 45_000),
);
const RESPONSE_TRACE_TTL_MS = 24 * 60 * 60_000;

async function saveResponseTrace(input: {
  path: string;
  params: Record<string, string>;
  status: "OK" | "FAILED";
  httpStatus?: number;
  headers?: Record<string, string>;
  rawBody?: string;
  error?: string;
}) {
  try {
    const capturedAt = new Date();
    const db = await getDb();
    await db.collection("sportsApiResponseSnapshots").insertOne({
      capturedAt,
      expiresAt: new Date(capturedAt.getTime() + RESPONSE_TRACE_TTL_MS),
      path: input.path,
      params: input.params,
      status: input.status,
      httpStatus: input.httpStatus ?? null,
      headers: input.headers ?? {},
      rawBody: input.rawBody ?? null,
      error: input.error ?? null,
      keyFingerprint: requestKeyFingerprint(),
      source: "lowblock-rest",
    });
  } catch (error) {
    console.error("[SportsAPI] Failed to save response trace:", error);
  }
}

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
      keyFingerprint: requestKeyFingerprint(),
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
    // Count only successful provider responses for this guard. A connection
    // timeout never gives us a provider quota response and must not consume
    // the entire local budget, otherwise one production-network incident
    // prevents every later recovery attempt until the next UTC day.
    const { start } = providerDayBounds();
    const used = await db.collection("sportsApiRequests").countDocuments({
      timestamp: { $gte: start },
      status: "OK",
      keyFingerprint: requestKeyFingerprint(),
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
      headers: {
        "x-api-key": env.SPORTSAPI_API_KEY || "",
        accept: "application/json",
        "user-agent": "LowBlock/1.0 SportsAPI sync",
      },
      signal: AbortSignal.timeout(SPORTSAPI_REQUEST_TIMEOUT_MS),
    });
    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();
    let body: SportsApiRestResponse<T> | null = null;
    let parseError: string | undefined;
    try {
      // Some upstream/proxy responses include a UTF-8 BOM before JSON.
      body = JSON.parse(rawBody.replace(/^\uFEFF/, "")) as SportsApiRestResponse<T>;
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }
    const remaining = firstHeader(response.headers, ["x-ratelimit-remaining", "x-rate-limit-remaining", "x-requests-remaining", "x-quota-remaining"]);
    const limit = firstHeader(response.headers, ["x-ratelimit-limit", "x-rate-limit-limit", "x-requests-limit", "x-quota-limit"]);
    const quota = { ...(remaining == null ? {} : { remaining }), ...(limit == null ? {} : { limit }) };
    const headers = Object.fromEntries(Array.from(response.headers.entries()));
    if (!response.ok || !body) {
      const preview = rawBody.replace(/\s+/g, " ").trim().slice(0, 240);
      const message = body?.error?.message || `SportsAPI REST request failed (${response.status})`;
      const diagnostic = {
        path,
        httpStatus: response.status,
        contentType,
        bodyBytes: Buffer.byteLength(rawBody, "utf8"),
        parseError: parseError || null,
        bodyPreview: preview || null,
      };
      const recordedError = `${message}; response=${JSON.stringify(diagnostic)}`;
      await saveResponseTrace({ path, params, status: "FAILED", httpStatus: response.status, headers, rawBody, error: recordedError });
      await trackRequest(path, params, performance.now() - startedAt, "FAILED", recordedError, quota);
      console.error("lowblock.sportsapi.invalid_response", diagnostic);
      return { success: false, events: [], error: { code: response.status, message } };
    }
    console.info(JSON.stringify({
      type: "lowblock.sportsapi.response_parsed",
      path,
      httpStatus: response.status,
      contentType,
      bodyBytes: Buffer.byteLength(rawBody, "utf8"),
      hasEvents: Array.isArray((body as any).events),
      hasData: Array.isArray((body as any).data),
    }));
    await saveResponseTrace({ path, params, status: "OK", httpStatus: response.status, headers, rawBody });
    await trackRequest(path, params, performance.now() - startedAt, "OK", undefined, quota);
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await saveResponseTrace({ path, params, status: "FAILED", error: message });
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
    status: "OK",
    keyFingerprint: requestKeyFingerprint(),
  });
  const latest = await db.collection<any>("sportsApiRequests").findOne(
    { timestamp: { $gte: start }, keyFingerprint: requestKeyFingerprint() },
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
 * Fetch every reported `/schedule/{date}` page and merge by provider event ID.
 * The WebSocket remains responsible for realtime deltas; REST is the
 * authoritative daily snapshot/discovery path.
 */
export async function getSportsApiDailyFixtures(
  dateString: string,
): Promise<SportsApiRestResponse<any>> {
  const now = Date.now();
  const cached = dailyFixturesCache.get(dateString);
  if (cached && cached.expiresAt > now) {
    console.info(JSON.stringify({ type: "lowblock.sportsapi.daily_cache_hit", date: dateString, source: "memory" }));
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
      persisted.data &&
      persisted.data.success !== false
    ) {
      dailyFixturesCache.set(dateString, {
        data: persisted.data,
        expiresAt: new Date(persisted.expiresAt).getTime(),
      });
      console.info(JSON.stringify({ type: "lowblock.sportsapi.daily_cache_hit", date: dateString, source: "mongo" }));
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

  // The provider paginates /schedule. A single successful page is not a
  // complete daily snapshot. Fetch every advertised page before caching.
  try {
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page += 1) {
      if (page > 20) throw new Error("SportsAPI schedule exceeded the 20-page safety limit");
      const params: Record<string, string> = page === 1 ? {} : { page: String(page) };
      console.info(JSON.stringify({ type: "lowblock.sportsapi.daily_request_started", date: dateString, page }));
      const res = await fetchSportsApi<any>(`/schedule/${dateString}`, params);
      if (res.success === false || res.error) {
        result = { success: false, events: [], error: res.error ?? { code: 502, message: "SportsAPI returned an unsuccessful response" } };
        break;
      }
      if (res.page != null && Number(res.page) !== page)
        throw new Error(`SportsAPI schedule page mismatch: expected ${page}, received ${res.page}`);
      const reportedPages = Number(res.totalPages ?? 1);
      if (!Number.isInteger(reportedPages) || reportedPages < 1 || reportedPages > 20)
        throw new Error(`Invalid SportsAPI schedule totalPages: ${res.totalPages}`);
      if (page > 1 && reportedPages !== totalPages)
        throw new Error(`SportsAPI schedule pagination changed from ${totalPages} to ${reportedPages}`);
      totalPages = reportedPages;
      const events = res.events ??
        (Array.isArray(res.data) ? res.data : (res.data as any)?.events);
      if (!Array.isArray(events))
        throw new Error(`SportsAPI schedule page ${page} has no events array`);
      for (const ev of events) {
        const id = ev.id ?? ev.eventId;
        if (id != null && !eventsMap.has(String(id))) eventsMap.set(String(id), ev);
      }
      console.info(JSON.stringify({ type: "lowblock.sportsapi.daily_page_finished", date: dateString, page, totalPages, providerEvents: events.length, uniqueEvents: eventsMap.size }));
    }
    if (result.success !== false)
      console.info(JSON.stringify({ type: "lowblock.sportsapi.daily_request_finished", date: dateString, ok: true, totalPages, providerEvents: eventsMap.size }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[SportsAPI] /schedule/${dateString} failed:`, message);
    result = { success: false, events: [], error: { code: 500, message } };
  }

  if (result.success !== false)
    result = { success: true, events: Array.from(eventsMap.values()) };
  // Never cache an unsuccessful provider response. Caching a transient
  // malformed/empty HTTP-200 response makes every retry during the cache
  // window fail without contacting the provider again.
  if (result.success !== false) {
    dailyFixturesCache.set(dateString, {
      data: result,
      expiresAt: now + DISCOVERY_CACHE_TTL_MS,
    });
  } else {
    dailyFixturesCache.delete(dateString);
  }
  try {
    const db = await getDb();
    if (result.success !== false) {
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
    }
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


