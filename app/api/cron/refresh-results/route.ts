import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getFootballProvider } from "@/lib/football/providerRegistry";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const provider = getFootballProvider();
    const result = provider.syncRecentResults
      ? await provider.syncRecentResults()
      : await runLeaderboardEngine();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "result refresh failed";
    console.error("recent_results_refresh_failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
