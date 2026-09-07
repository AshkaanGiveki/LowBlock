import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getDetailedLeaderboard, normalizeDetailedSort, type DetailedSort } from "@/lib/domain/detailedLeaderboards";
import { getLatestSeasonStartYear } from "@/lib/football/data";
import { jsonWithTiming, withServerTiming } from "@/lib/observability/serverTiming";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timings: Array<{ name: string; durationMs: number }> = [];
  const url = new URL(request.url); const clubId = url.searchParams.get("clubId"); const userId = await withServerTiming("auth", () => currentUserId(), timings); const db = await withServerTiming("db", () => getDb(), timings);
  if (clubId) {
    if (!userId || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "CLUB_ACCESS_REQUIRED" }, { status: 403 });
    const membership = await withServerTiming("membership", () => db.collection("clubMemberships").findOne({ clubId, userId, leftAt: null }), timings);
    if (!membership) return NextResponse.json({ error: "CLUB_ACCESS_REQUIRED" }, { status: 403 });
  }
  const weekly = url.searchParams.get("weekly") === "true";
  const year = weekly ? null : Number(url.searchParams.get("seasonStartYear") ?? await getLatestSeasonStartYear());
  const data = await withServerTiming("leaderboard", () => getDetailedLeaderboard(db, { clubId, weekly, weeklyOffset: url.searchParams.get("week") === "previous" ? 1 : 0, seasonStartYear: year, viewerUserId: userId, page: Number(url.searchParams.get("page") ?? 1), pageSize: Number(url.searchParams.get("pageSize") ?? 25), sort: normalizeDetailedSort(url.searchParams.get("sort")), direction: url.searchParams.get("direction") === "asc" ? "asc" : "desc" }), timings);
  return jsonWithTiming(data, timings, { headers: { "Cache-Control": "private, no-store" } });
}
