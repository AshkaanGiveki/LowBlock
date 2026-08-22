import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongo";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
export async function GET(req: Request) { const url = new URL(req.url); const year = url.searchParams.get("seasonStartYear"); const leagueCode = url.searchParams.get("leagueCode"); const clubId = url.searchParams.get("clubId"); const limit = Number(url.searchParams.get("limit") ?? 40); const rows = await getCanonicalLeaderboard(await getDb(), { seasonStartYear: year ? Number(year) : null, leagueCode, clubId }, Math.min(Math.max(limit, 1), 50)); return NextResponse.json({ rows, nextCursor: rows.at(-1)?.cursor ?? null }); }

