import { getDb } from "@/lib/db/mongo";
import { unstable_cache } from "next/cache";

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

const getCachedMatches = unstable_cache(async (leagueCode: string, matchday: number | null, limit: number, from: number, to: number) => {
  const db = await getDb();
  const query = {
    provider: "football-api" as const,
    // Only expose records written from a verified Football API response.
    rawApiResponse: { $exists: true },
    status: { $nin: ["VOID", "CANCELLED"] },
    kickoffAt: { $gte: new Date(from), $lte: new Date(to) },
    ...(leagueCode ? { leagueCode } : {}),
    ...(matchday !== null ? { matchday } : {}),
  };
  return db.collection<MatchRecord>("matches").find(query).sort({ kickoffAt: 1 }).limit(limit).toArray();
}, ["lowblock-matches"], { revalidate: 60, tags: ["matches"] });

export async function getMatches(filters: { leagueCode?: string; matchday?: number; limit?: number } = {}) {
  const now = Date.now();
  return getCachedMatches(filters.leagueCode ?? "", filters.matchday ?? null, filters.limit ?? 50, now - 2 * 60 * 60 * 1000, now + 14 * 864e5);
}

export async function getMatch(providerMatchId: string) {
  const db = await getDb();
  return db.collection<MatchRecord>("matches").findOne({
    provider: "football-api",
    providerMatchId,
    rawApiResponse: { $exists: true },
    status: { $nin: ["VOID", "CANCELLED"] },
  });
}

export async function getPredictions(matchIds: string[], userId = "guest") {
  if (!matchIds.length) return new Map();
  const db = await getDb();
  const rows = await db.collection<{ matchId: string; homeGoals: number; awayGoals: number }>("predictions").find({ userId, matchId: { $in: matchIds } }).toArray();
  return new Map(rows.map((row) => [row.matchId, row]));
}
