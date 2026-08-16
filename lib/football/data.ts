import { getDb } from "@/lib/db/mongo";

export type MatchRecord = {
  _id?: unknown;
  provider: "football-api";
  providerMatchId: string;
  leagueCode: string;
  matchday: number;
  kickoffAt: Date;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: { id: number; name: string; logoUrl: string | null };
  awayTeam: { id: number; name: string; logoUrl: string | null };
  seasonStartYear: number;
  rawApiResponse?: unknown;
};

export async function getMatches(filters: { leagueCode?: string; matchday?: number; limit?: number } = {}) {
  const db = await getDb();
  const now = new Date();
  const query = {
    provider: "football-api" as const,
    // Only expose records written from a verified Football API response.
    rawApiResponse: { $exists: true },
    status: { $nin: ["POSTPONED"] },
    kickoffAt: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000), $lte: new Date(now.getTime() + 14 * 864e5) },
    ...(filters.leagueCode ? { leagueCode: filters.leagueCode } : {}),
    ...(filters.matchday !== undefined ? { matchday: filters.matchday } : {}),
  };
  return db.collection<MatchRecord>("matches").find(query).sort({ kickoffAt: 1 }).limit(filters.limit ?? 50).toArray();
}

export async function getPredictions(matchIds: string[], userId = "guest") {
  if (!matchIds.length) return new Map();
  const db = await getDb();
  const rows = await db.collection<{ matchId: string; homeGoals: number; awayGoals: number }>("predictions").find({ userId, matchId: { $in: matchIds } }).toArray();
  return new Map(rows.map((row) => [row.matchId, row]));
}
