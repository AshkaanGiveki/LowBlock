import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";
import { Client } from "@upstash/qstash";
import { getH2HWeek } from "@/lib/domain/h2h";
import { appDateKey } from "@/lib/football/scheduleWindow";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const batchIndex = Math.max(
      0,
      Number(url.searchParams.get("batch") ?? "0") || 0,
    );
    const result = await runLeaderboardEngine({
      recentOnly: true,
      batchIndex,
      batchSize: 5,
    });
    let queuedNextBatch = false;
    if (
      "hasMore" in result &&
      result.hasMore &&
      env.QSTASH_TOKEN &&
      env.NEXT_PUBLIC_APP_URL &&
      env.CRON_SECRET
    ) {
      await new Client({ token: env.QSTASH_TOKEN }).publishJSON({
        url: `${env.NEXT_PUBLIC_APP_URL}/api/cron/rebuild-leaderboards?batch=${batchIndex + 1}`,
        body: { reason: "incremental-leaderboard-rebuild", batch: batchIndex + 1 },
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        deduplicationId: `lowblock-leaderboard-rebuild-${new Date().toISOString().slice(0, 10)}-${batchIndex + 1}`,
      });
      queuedNextBatch = true;
    }
    let queuedH2H = false;
    const week = getH2HWeek();
    const isFinalBatch = !result.hasMore;
    const isH2HWeekStart = appDateKey() === appDateKey(week.start);
    if (
      isFinalBatch &&
      isH2HWeekStart &&
      env.H2H_ENABLED &&
      env.QSTASH_TOKEN &&
      env.NEXT_PUBLIC_APP_URL &&
      env.CRON_SECRET
    ) {
      await new Client({ token: env.QSTASH_TOKEN }).publishJSON({
        url: `${env.NEXT_PUBLIC_APP_URL}/api/cron/h2h`,
        body: { reason: "weekly-h2h-after-leaderboards", weekKey: week.key },
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        notBefore: Math.floor((Date.now() + 60_000) / 1000),
        deduplicationId: `lowblock-h2h-discovery-${week.key}`,
      });
      queuedH2H = true;
    }
    return NextResponse.json({ ok: true, queuedNextBatch, queuedH2H, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "leaderboard rebuild failed";
    console.error("leaderboard_rebuild_failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
