import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ensureIndexes, ensurePerformanceIndexes } from "@/lib/db/mongo";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";

export async function GET(request: Request) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await ensureIndexes();
    await ensurePerformanceIndexes();
    const result = await runLeaderboardEngine();
    return NextResponse.json({ ok: true, ...result });
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
