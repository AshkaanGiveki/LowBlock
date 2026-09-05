import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getMatchesPage, getPredictions, type MatchPageCursor } from "@/lib/football/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawCursor = url.searchParams.get("cursor");
    let cursor: MatchPageCursor | null = null;
    if (rawCursor) {
      try { cursor = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8")) as MatchPageCursor; }
      catch { return NextResponse.json({ error: "INVALID_MATCH_CURSOR" }, { status: 400 }); }
    }
    const page = await getMatchesPage(Number(url.searchParams.get("limit") ?? 30), cursor);
    const predictions = await getPredictions(page.matches.map((match) => match.providerMatchId), (await currentUserId()) ?? "guest");
    return NextResponse.json({ ...page, predictions: Object.fromEntries(predictions) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "matches unavailable" }, { status: 500 });
  }
}
