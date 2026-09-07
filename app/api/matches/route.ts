import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getMatchesPage, getPredictions, type MatchPageCursor } from "@/lib/football/data";
import { jsonWithTiming, timingHeaders, withServerTiming } from "@/lib/observability/serverTiming";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timings: Array<{ name: string; durationMs: number }> = [];
  try {
    const url = new URL(request.url);
    const rawCursor = url.searchParams.get("cursor");
    let cursor: MatchPageCursor | null = null;
    if (rawCursor) { try { cursor = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8")) as MatchPageCursor; } catch { return NextResponse.json({ error: "INVALID_MATCH_CURSOR" }, { status: 400 }); } }
    const [page, userId] = await Promise.all([withServerTiming("matches", () => getMatchesPage(Number(url.searchParams.get("limit") ?? 30), cursor), timings), withServerTiming("auth", () => currentUserId(), timings)]);
    const predictions = await withServerTiming("predictions", () => getPredictions(page.matches.map((match) => match.providerMatchId), userId ?? "guest"), timings);
    return jsonWithTiming({ ...page, predictions: Object.fromEntries(predictions) }, timings, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "matches unavailable" }, { status: 500, headers: timingHeaders(timings) });
  }
}
