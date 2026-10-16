import { NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { ensureCurrentH2HLeagues, getH2HWeek } from "@/lib/domain/h2h";
import { providerWeekDateKeys } from "@/lib/football/scheduleWindow";
import { SportsApiFootballProvider } from "@/lib/football/sportsapi/provider";

export const maxDuration = 60;

const DISCOVERY_ATTEMPTS = 2;
const CLUB_BATCH_SIZE = 5;

function authorized(request: Request) {
  return Boolean(env.CRON_SECRET) && request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

async function enqueue(path: string, body: Record<string, unknown>, deduplicationId: string, delaySeconds = 2) {
  if (!env.QSTASH_TOKEN || !env.NEXT_PUBLIC_APP_URL || !env.CRON_SECRET) return false;
  await new Client({ token: env.QSTASH_TOKEN }).publishJSON({
    url: `${env.NEXT_PUBLIC_APP_URL}${path}`,
    body,
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    notBefore: Math.floor((Date.now() + delaySeconds * 1000) / 1000),
    deduplicationId,
  });
  return true;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!env.H2H_ENABLED) return NextResponse.json({ enabled: false, created: 0 });

  const url = new URL(request.url);
  const phase = url.searchParams.get("phase") ?? "discovery";
  const batchIndex = Math.max(0, Number(url.searchParams.get("batch") ?? "0") || 0);
  const retry = Math.max(0, Number(url.searchParams.get("retry") ?? "0") || 0);
  const week = getH2HWeek();
  const dates = providerWeekDateKeys(week.start);
  const baseId = `lowblock-h2h-${week.key}`;

  if (phase === "materialize") {
    const result = await ensureCurrentH2HLeagues(await getDb(), { batchIndex, batchSize: CLUB_BATCH_SIZE });
    let queuedNextBatch = false;
    if (result.hasMore) {
      queuedNextBatch = await enqueue(
        `/api/cron/h2h?phase=materialize&batch=${batchIndex + 1}`,
        { reason: "h2h-materialize-next", weekKey: week.key, batch: batchIndex + 1 },
        `${baseId}-materialize-${batchIndex + 1}`,
      );
    }
    return NextResponse.json({ ...result, phase, queuedNextBatch });
  }

  if (batchIndex >= dates.length) {
    const provider = new SportsApiFootballProvider();
    const finalized = await provider.finalizeWeekDates(dates);
    if (!finalized.discovery.complete) {
      return NextResponse.json({ ok: false, phase, error: "weekly discovery is incomplete", discovery: finalized.discovery }, { status: 409 });
    }
    const queuedMaterialization = await enqueue(
      "/api/cron/h2h?phase=materialize&batch=0",
      { reason: "h2h-materialize-start", weekKey: week.key },
      `${baseId}-materialize-0`,
    );
    return NextResponse.json({ ok: true, phase, discovery: finalized.discovery, queuedMaterialization });
  }

  const dateString = dates[batchIndex];
  try {
    const result = await new SportsApiFootballProvider().syncWeekDates([dateString]);
    // Publish this day's slate immediately. Future dates may not exist in the
    // provider yet, so weekly completeness must not block today's H2H round.
    const dailyH2H = await ensureCurrentH2HLeagues(await getDb(), { sourceDate: dateString, batchIndex: 0, batchSize: CLUB_BATCH_SIZE });
    const nextBatch = batchIndex + 1;
    const queuedNextBatch = await enqueue(
      `/api/cron/h2h?batch=${nextBatch}`,
      { reason: "h2h-discovery-next", weekKey: week.key, dateString, batch: nextBatch },
      `${baseId}-discovery-${nextBatch}`,
    );
    return NextResponse.json({ ok: true, phase, batchIndex, dateString, complete: result.discovery.complete, dailyH2H, queuedNextBatch });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (retry < DISCOVERY_ATTEMPTS - 1) {
      const queuedRetry = await enqueue(
        `/api/cron/h2h?batch=${batchIndex}&retry=${retry + 1}`,
        { reason: "h2h-discovery-retry", weekKey: week.key, dateString, batch: batchIndex, retry: retry + 1 },
        `${baseId}-discovery-${batchIndex}-retry-${retry + 1}`,
        30,
      );
      return NextResponse.json({ ok: false, phase, batchIndex, dateString, retry, queuedRetry, error: message }, { status: 202 });
    }
    return NextResponse.json({ ok: false, phase, batchIndex, dateString, retry, error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
