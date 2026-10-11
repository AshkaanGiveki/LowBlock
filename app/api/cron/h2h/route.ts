import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { ensureCurrentH2HLeagues } from "@/lib/domain/h2h";

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await ensureCurrentH2HLeagues(await getDb()));
}
export async function POST(request: Request) { return GET(request); }
