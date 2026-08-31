import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyQstashSignature } from "@/lib/notifications/qstash";
import { getDb } from "@/lib/db/mongo";
import { publishFirstMatchChannelReminder } from "@/lib/notifications/channel";

export async function POST(request: Request) {
  const body = await request.text();
  if (!await verifyQstashSignature(body, request.headers.get("Upstash-Signature"), request.url)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let json: unknown; try { json = JSON.parse(body); } catch { return NextResponse.json({ error: "invalid payload" }, { status: 400 }); }
  const parsed = z.object({ dateKey: z.string().min(8), matchId: z.string().min(1) }).safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...(await publishFirstMatchChannelReminder(await getDb(), parsed.data.dateKey, parsed.data.matchId)) }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "channel reminder failed" }, { status: 500 }); }
}
