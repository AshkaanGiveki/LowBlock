import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { ensureCurrentH2HLeagues, getH2HWeek } from "@/lib/domain/h2h";
import { providerWeekDateKeys } from "@/lib/football/scheduleWindow";
import { SportsApiFootballProvider } from "@/lib/football/sportsapi/provider";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!env.H2H_ENABLED)
    return NextResponse.json({ enabled: false, created: 0 });

  // H2H needs a complete Friday-to-Thursday discovery manifest. The normal
  // daily sync only loads yesterday/today/tomorrow, so prepare the full week
  // before trying to materialize the current H2H leagues.
  const week = getH2HWeek();
  const dates = providerWeekDateKeys(week.start);
  const discovery = await new SportsApiFootballProvider().syncWeekDates(dates);
  const h2h = await ensureCurrentH2HLeagues(await getDb());
  return NextResponse.json({
    ...h2h,
    discovery: {
      complete: discovery.discovery.complete,
      dates,
      manifests: discovery.discovery.manifests,
      fixturesUpdated: discovery.total,
    },
  });
}
export async function POST(request: Request) { return GET(request); }
