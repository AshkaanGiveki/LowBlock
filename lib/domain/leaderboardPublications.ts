import { ObjectId, type Db } from "mongodb";
import { DEFAULT_CLUB_LEAGUE_CODES } from "@/lib/football/leagues";
import { getIranWeeklyPeriod } from "@/lib/domain/leaderboardPeriods";

export type PublishedScope = {
  clubId?: string | null;
  seasonStartYear?: number | null;
  leagueCode?: string | null;
  matchday?: number | null;
  weekly?: boolean;
  weeklyOffset?: number;
};

export const MAX_PUBLISHED_ROWS = 100;

/** Only featured competition views are published; detailed round/filter views remain on demand. */
export function leaderboardPublicationKey(scope: PublishedScope, now = new Date()): string | null {
  if (scope.matchday != null) return null;
  const period = scope.weekly
    ? `WEEK:${getIranWeeklyPeriod(now, scope.weeklyOffset ?? 0).start.toISOString()}`
    : scope.seasonStartYear != null
      ? `SEASON:${scope.seasonStartYear}`
      : "HISTORY";
  if (scope.clubId && scope.leagueCode) return null;
  if (scope.clubId) return `CLUB:${scope.clubId}:${period}`;
  if (scope.leagueCode)
    return scope.weekly || scope.seasonStartYear == null
      ? null
      : `TOURNAMENT:${scope.leagueCode}:${scope.seasonStartYear}`;
  return `GLOBAL:${period}`;
}

export function clubPublicationPolicy(codes: string[]) {
  return [...new Set(codes)].sort().join("|");
}

/**
 * A missing or invalid publication means falling back to the authoritative
 * score query. An intentionally empty published list is a valid empty ranking.
 */
export async function readPublishedLeaderboard(
  db: Db,
  scope: PublishedScope,
  limit: number,
  cursor?: { userId: string; points: number },
): Promise<any[] | null> {
  if (limit > MAX_PUBLISHED_ROWS) return null;
  const key = leaderboardPublicationKey(scope);
  if (!key) return null;
  const publication = await db.collection<any>("leaderboardPublications")
    .findOne({ _id: key }, { projection: { rows: 1, policyKey: 1 } });
  if (!publication || !Array.isArray(publication.rows)) return null;
  if (scope.clubId) {
    if (!ObjectId.isValid(scope.clubId)) return null;
    const club = await db.collection<any>("clubs").findOne(
      { _id: new ObjectId(scope.clubId) },
      { projection: { leaderboardCompetitionCodes: 1 } },
    );
    const codes = Array.isArray(club?.leaderboardCompetitionCodes)
      ? club.leaderboardCompetitionCodes
      : DEFAULT_CLUB_LEAGUE_CODES;
    // A club admin may update eligible competitions between sync jobs.
    // Never serve a published list built under a different rule set.
    if (publication.policyKey !== clubPublicationPolicy(codes)) return null;
  }
  const rows = publication.rows as Array<{ userId: string; points: number }>;
  if (!cursor) return rows.slice(0, limit);
  const index = rows.findIndex(
    (row) => row.userId === cursor.userId && row.points === cursor.points,
  );
  // The cursor is outside the published top N; use the full query instead.
  if (index < 0) return null;
  if (index + 1 >= rows.length) return null;
  return rows.slice(index + 1, index + 1 + limit);
}
