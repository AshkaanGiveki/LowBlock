import { Client } from "@upstash/qstash";
import type { Db } from "mongodb";
import { env } from "@/lib/env";
import { remainingApiRequests } from "@/lib/football/api-sports/client";
import { syncFootballApiDate } from "@/lib/football/api-sports/sync";

const RESERVED_REQUESTS = 30;
const POLL_START_AFTER_MS = 15 * 60_000;
const POLL_END_AFTER_LAST_KICKOFF_MS = 3 * 60 * 60_000 + 25 * 60_000;

function utcBounds(dateKey: string) { const start = new Date(`${dateKey}T00:00:00.000Z`); return { start, end: new Date(start.getTime() + 86_400_000) }; }

export async function scheduleMatchdayPolling(db: Db, dateKey: string) {
  if (!env.QSTASH_TOKEN || !env.NEXT_PUBLIC_APP_URL) return { scheduled: 0, reason: "qstash-not-configured" };
  const { start, end } = utcBounds(dateKey);
  const matches = await db.collection<any>("matches").find({ provider: "football-api", kickoffAt: { $gte: start, $lt: end }, status: { $nin: ["VOID", "CANCELLED", "POSTPONED"] } }, { projection: { kickoffAt: 1 } }).sort({ kickoffAt: 1 }).toArray();
  if (!matches.length) return { scheduled: 0, reason: "no-matches" };
  const firstKickoff = new Date(matches[0].kickoffAt).getTime();
  const lastKickoff = new Date(matches.at(-1)!.kickoffAt).getTime();
  const windowStart = firstKickoff + POLL_START_AFTER_MS;
  const windowEnd = lastKickoff + POLL_END_AFTER_LAST_KICKOFF_MS;
  const remaining = await remainingApiRequests();
  const budget = Math.max(0, remaining - RESERVED_REQUESTS);
  if (budget === 0 || windowEnd < windowStart) return { scheduled: 0, reason: budget === 0 ? "reserved-quota-only" : "invalid-window", remaining, budget };
  const intervalSeconds = Math.max(10, Math.ceil(((windowEnd - windowStart) / 1000 / budget) / 10) * 10);
  const now = Date.now(); if (now > windowEnd) return { scheduled: 0, reason: "window-ended", remaining, budget, windowStart: new Date(windowStart).toISOString(), windowEnd: new Date(windowEnd).toISOString() }; let scheduled = 0;
  for (let at = windowStart; at <= windowEnd; at += intervalSeconds * 1000) {
    if (at < now && scheduled > 0) continue;
    await new Client({ token: env.QSTASH_TOKEN }).publishJSON({ url: `${env.NEXT_PUBLIC_APP_URL}/api/notifications/matchday-poll`, body: { dateKey }, notBefore: Math.floor(Math.max(at, now + 5_000) / 1000), deduplicationId: `lowblock-matchday-poll-${dateKey}-${at}` });
    scheduled++;
  }
  return { scheduled, dateKey, remaining, budget, windowStart: new Date(windowStart).toISOString(), windowEnd: new Date(windowEnd).toISOString(), intervalSeconds };
}

export async function pollMatchday(dateKey: string) {
  const remaining = await remainingApiRequests();
  if (remaining <= RESERVED_REQUESTS) return { synced: false, reason: "reserved-quota-only", remaining };
  return { synced: true, remainingBefore: remaining, ...(await syncFootballApiDate(dateKey)) };
}
