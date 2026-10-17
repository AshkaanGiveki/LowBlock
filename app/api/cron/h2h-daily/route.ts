import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { getFootballProvider } from "@/lib/football/providerRegistry";
import { appDateKey } from "@/lib/football/scheduleWindow";
import { ensureCurrentH2HLeagues, getH2HWeek, isH2HEnabled, refreshActiveH2HResults } from "@/lib/domain/h2h";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isH2HEnabled()) return NextResponse.json({ enabled: false });

  const tomorrow = appDateKey(new Date(Date.now() + 86_400_000));
  const provider = getFootballProvider();
  const fixtureSync = await provider.syncDate(tomorrow, { deferScoring: true });
  const db = await getDb();
  // SportsAPI's syncDate already materializes today's/tomorrow's H2H slate.
  // Keep the fallback for providers that do not own H2H refreshes.
  const schedule = provider.name === "sportsapi"
    ? { delegatedToProvider: true }
    : await ensureCurrentH2HLeagues(db, { sourceDate: tomorrow, batchIndex: 0, batchSize: 1000 });
  const results = await refreshActiveH2HResults(db, getH2HWeek().key);
  return NextResponse.json({ ok: true, tomorrow, fixtureSync, schedule, results });
}

export async function POST(request: Request) {
  return GET(request);
}
