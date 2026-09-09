import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongo";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import {
  jsonWithTiming,
  withServerTiming,
} from "@/lib/observability/serverTiming";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const started = performance.now();
  const timings: Array<{ name: string; durationMs: number }> = [];
  const url = new URL(req.url);
  const year = url.searchParams.get("seasonStartYear");
  const leagueCode = url.searchParams.get("leagueCode");
  const clubId = url.searchParams.get("clubId");
  const weekly = url.searchParams.get("weekly") === "true";
  const weeklyOffset = url.searchParams.get("week") === "previous" ? 1 : 0;
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 20), 1),
    50,
  );
  const encoded = url.searchParams.get("cursor");
  let cursor:
    | {
        points: number;
        exact: number;
        correctOutcome?: number;
        globalPoints?: number;
        earliestPredictionAt?: number;
        predictions: number;
        userId: string;
      }
    | undefined;
  if (encoded) {
    try {
      cursor = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
  }
  const db = await withServerTiming("db", () => getDb(), timings);
  const rows = await withServerTiming(
    "leaderboard",
    () =>
      getCanonicalLeaderboard(
        db,
        {
          seasonStartYear: weekly ? null : year ? Number(year) : null,
          leagueCode,
          clubId,
          weekly,
          weeklyOffset,
        },
        limit,
        cursor,
      ),
    timings,
  );
  const next = rows.at(-1)?.cursor;
  timings.push({
    name: "total",
    durationMs: Math.round((performance.now() - started) * 100) / 100,
  });
  return jsonWithTiming(
    {
      rows,
      nextCursor: next
        ? Buffer.from(JSON.stringify(next)).toString("base64url")
        : null,
    },
    timings,
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
