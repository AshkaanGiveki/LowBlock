import { getDb } from "@/lib/db/mongo";
import { unstable_cache } from "next/cache";
import { GLOBAL_LEAGUE_CODES } from "@/lib/football/leagues";

export type MatchRecord = {
  _id?: unknown;
  provider: "football-api";
  providerMatchId: string;
  leagueCode: string;
  matchday: number;
  kickoffAt: Date;
  status: string;
  elapsed?: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: { id: number; name: string; logoUrl: string | null };
  awayTeam: { id: number; name: string; logoUrl: string | null };
  seasonStartYear: number;
  rawApiResponse?: unknown;
};

const getCachedMatches = unstable_cache(async (leagueCode: string, matchday: number | null, limit: number, from: number, to: number) => {
  const db = await getDb();
  const query = {
    provider: "football-api" as const,
    // Only expose records written from a verified Football API response.
    rawApiResponse: { $exists: true },
    // 207 is Switzerland's Super League, not Turkey's Super Cup (551).
    $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }],
    status: { $nin: ["VOID", "CANCELLED"] },
    kickoffAt: { $gte: new Date(from), $lte: new Date(to) },
    ...(leagueCode ? { leagueCode } : {}),
    ...(matchday !== null ? { matchday } : {}),
  };
  return db.collection<MatchRecord>("matches").find(query).sort({ kickoffAt: 1 }).limit(limit).toArray();
}, ["lowblock-matches"], { revalidate: 60, tags: ["matches"] });

export async function getMatches(filters: { leagueCode?: string; matchday?: number; limit?: number } = {}) {
  const now = Date.now();
  return getCachedMatches(filters.leagueCode ?? "", filters.matchday ?? null, filters.limit ?? 50, now - 24 * 60 * 60 * 1000, now + 14 * 864e5);
}

export type MatchPageCursor = { globalPriority: 0 | 1; kickoffAt: string; providerMatchId: string };

function todayBounds() {
  const dateKey = new Date().toISOString().slice(0, 10);
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export async function getMatchesPage(limit = 30, cursor?: MatchPageCursor | null) {
  const db = await getDb();
  const bounds = todayBounds();
  const query: any = {
    provider: "football-api",
    rawApiResponse: { $exists: true },
    $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }],
    status: { $nin: ["VOID", "CANCELLED"] },
    kickoffAt: { $gte: bounds.start, $lt: bounds.end },
  };
  const cursorKickoff = cursor ? new Date(cursor.kickoffAt) : null;
  if (cursor) {
    if (!cursorKickoff || !Number.isFinite(cursorKickoff.getTime()) || !cursor.providerMatchId) throw new Error("INVALID_MATCH_CURSOR");
    if (cursor.globalPriority !== 0 && cursor.globalPriority !== 1) throw new Error("INVALID_MATCH_CURSOR");
  }
  const pageSize = Math.min(Math.max(limit, 1), 50);
  const pipeline: any[] = [
    { $match: query },
    { $addFields: { globalPriority: { $cond: [{ $in: ["$leagueCode", GLOBAL_LEAGUE_CODES] }, 0, 1] } } },
  ];
  if (cursor) {
    pipeline.push({ $match: { $or: [
      { globalPriority: { $gt: cursor.globalPriority } },
      { globalPriority: cursor.globalPriority, kickoffAt: { $gt: cursorKickoff! } },
      { globalPriority: cursor.globalPriority, kickoffAt: cursorKickoff!, providerMatchId: { $gt: cursor.providerMatchId } },
    ] } });
  }
  pipeline.push({ $sort: { globalPriority: 1, kickoffAt: 1, providerMatchId: 1 } }, { $limit: pageSize + 1 }, { $project: { globalPriority: 0 } });
  const matches = await db.collection<MatchRecord>("matches").aggregate<MatchRecord>(pipeline).toArray();
  const hasMore = matches.length > pageSize;
  const page = hasMore ? matches.slice(0, -1) : matches;
  const last = page.at(-1);
  return { matches: page, hasMore, nextCursor: last ? { globalPriority: (GLOBAL_LEAGUE_CODES.includes(last.leagueCode as never) ? 0 : 1) as 0 | 1, kickoffAt: new Date(last.kickoffAt).toISOString(), providerMatchId: last.providerMatchId } : null };
}

export async function getMatch(providerMatchId: string) {
  const db = await getDb();
  return db.collection<MatchRecord>("matches").findOne({
    provider: "football-api",
    providerMatchId,
    rawApiResponse: { $exists: true },
    $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }],
    status: { $nin: ["VOID", "CANCELLED"] },
  });
}

export async function getPredictions(matchIds: string[], userId = "guest") {
  if (!matchIds.length) return new Map();
  const db = await getDb();
  const rows = await db.collection<{ matchId: string; homeGoals: number; awayGoals: number }>("predictions").find({ userId, matchId: { $in: matchIds } }).toArray();
  return new Map(rows.map((row) => [row.matchId, row]));
}
