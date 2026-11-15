import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Read-only football intelligence: a single DB-backed request for the match
 * overview, historical insights and persisted realtime details.
 * Never contacts a football provider and never starts a WebSocket per viewer.
 * Missing data stays unavailable rather than being fabricated.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(matchId)) {
    return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const [match, insights, details] = await Promise.all([
      db.collection<any>("matches").findOne(
        { provider: { $in: ["sportsapi", "football-api"] }, providerMatchId: matchId },
        { projection: { _id: 0, provider: 1, providerMatchId: 1, leagueCode: 1, kickoffAt: 1, status: 1, homeTeam: 1, awayTeam: 1, homeGoals: 1, awayGoals: 1 } },
      ),
      db.collection<any>("matchInsights").findOne({ matchId }, { projection: { _id: 0 } }),
      db.collection<any>("matchDetails").findOne({ matchId }, { projection: { _id: 0, score: 1, incidents: 1, stats: 1, lineups: 1, updatedAt: 1 } }),
    ]);
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    // Provider IDs are not interchangeable. SportsAPI snapshots must never be
    // attached to an API-Football fixture with a coincidentally equal ID.
    const snapshot = match.provider === "sportsapi" ? details ?? null : null;
    const payload = {
      match,
      live: snapshot ? {
        score: snapshot.score ?? null,
        incidents: snapshot.incidents ?? [],
        stats: snapshot.stats ?? [],
        lineups: snapshot.lineups ?? null,
        updatedAt: details?.updatedAt ?? null,
      } : null,
      historical: insights ?? null,
      availability: {
        live: Boolean(snapshot),
        incidents: Boolean(snapshot?.incidents?.length),
        stats: Boolean(snapshot?.stats?.length),
        lineups: Boolean(snapshot?.lineups?.home?.players?.length || snapshot?.lineups?.away?.players?.length),
        h2h: Boolean(insights?.h2h?.length),
        form: Boolean(insights?.form?.length || insights?.homeForm?.length || insights?.awayForm?.length),
        standings: Boolean(insights?.standings),
      },
    };
    // Conditional responses reduce bandwidth when the worker has not changed
    // a snapshot. No provider requests or per-viewer upstream subscriptions.
    const body = JSON.stringify(payload);
    const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
    const headers = {
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: etag,
      Vary: "Accept-Encoding",
    };
    const previous = request.headers.get("if-none-match");
    if (previous?.split(",").some((tag) => tag.trim() === etag)) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(body, {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("[MatchIntelligence] Read failed:", error);
    return NextResponse.json({ error: "Match intelligence temporarily unavailable" }, { status: 503 });
  }
}
