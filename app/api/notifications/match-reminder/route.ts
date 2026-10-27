import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { processMatchReminder } from "@/lib/notifications/reminders";
export async function POST(req: Request) {
  const body = await req.text();
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const parsed = z.object({ matchId: z.string().min(1) }).safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  return NextResponse.json({
    ok: true,
    ...(await processMatchReminder(parsed.data.matchId)),
  });
}
