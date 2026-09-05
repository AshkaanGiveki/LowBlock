import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyQstashSignature } from "@/lib/notifications/qstash";
import { pollMatchday } from "@/lib/notifications/matchday";

export async function POST(request: Request) {
  const body = await request.text();
  if (!await verifyQstashSignature(body, request.headers.get("Upstash-Signature"), request.url)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let json: unknown; try { json = JSON.parse(body); } catch { return NextResponse.json({ error: "invalid payload" }, { status: 400 }); }
  const parsed = z.object({ dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...(await pollMatchday(parsed.data.dateKey)) }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "matchday poll failed" }, { status: 500 }); }
}
