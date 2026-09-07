import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.name !== "string" || typeof payload.value !== "number") return NextResponse.json({ error: "invalid telemetry" }, { status: 400 });
  console.info(JSON.stringify({ type: "lowblock.performance", name: payload.name, value: payload.value, path: typeof payload.path === "string" ? payload.path : undefined, navigationType: payload.navigationType, metadata: payload.metadata, at: payload.at }));
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
