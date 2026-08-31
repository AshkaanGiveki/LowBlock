import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { publishChannelMatches } from "@/lib/notifications/channel";

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await publishChannelMatches(await getDb())) }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "channel matches failed" }, { status: 500 }); }
}
