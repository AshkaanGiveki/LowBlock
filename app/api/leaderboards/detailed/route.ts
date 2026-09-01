import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getDetailedLeaderboard, normalizeDetailedSort, type DetailedSort } from "@/lib/domain/detailedLeaderboards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url); const clubId = url.searchParams.get("clubId"); const userId = await currentUserId(); const db = await getDb();
  if (clubId) {
    if (!userId || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "CLUB_ACCESS_REQUIRED" }, { status: 403 });
    const membership = await db.collection("clubMemberships").findOne({ clubId, userId, leftAt: null });
    if (!membership) return NextResponse.json({ error: "CLUB_ACCESS_REQUIRED" }, { status: 403 });
  }
  const latest = await db.collection<any>("matches").findOne({}, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } });
  const weekly = url.searchParams.get("weekly") === "true";
  const year = weekly ? null : Number(url.searchParams.get("seasonStartYear") ?? latest?.seasonStartYear ?? new Date().getUTCFullYear());
  const data = await getDetailedLeaderboard(db, { clubId, weekly, weeklyOffset: url.searchParams.get("week") === "previous" ? 1 : 0, seasonStartYear: year, page: Number(url.searchParams.get("page") ?? 1), pageSize: Number(url.searchParams.get("pageSize") ?? 25), sort: normalizeDetailedSort(url.searchParams.get("sort")), direction: url.searchParams.get("direction") === "asc" ? "asc" : "desc" });
  return NextResponse.json(data);
}
