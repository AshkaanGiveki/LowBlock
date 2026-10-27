import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";

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
    // Local server workers process the complete recent window in one bounded
    // pass; no external queue is required.
    let result = await runLeaderboardEngine({
      recentOnly: true,
      batchIndex,
      batchSize: 5000,
    });
    return NextResponse.json({ ok: true, dispatcher: "local-worker", ...result });
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
