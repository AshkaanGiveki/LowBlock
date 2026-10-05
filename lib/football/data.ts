import { getFootballProvider } from "@/lib/football/providerRegistry";
import { getDb } from "@/lib/db/mongo";
import { unstable_cache } from "next/cache";
import type { ProviderName } from "./types";
import { ensureSportsApiBackgroundService } from "./sportsapi/backgroundService";
import {
  GLOBAL_LEAGUE_CODES,
  IMPORTANT_NATIONAL_TEAM_NAMES,
  isFeaturedFixture,
} from "@/lib/football/leagues";

export type MatchRecord = {
  _id?: unknown;
  provider: ProviderName;
  providerMatchId: string;
  leagueCode: string;
  matchday: number;
  kickoffAt: Date | string;
  status: string;
  elapsed?: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: { id: number; name: string; logoUrl: string | null };
  awayTeam: { id: number; name: string; logoUrl: string | null };
  seasonStartYear: number;
  rawApiResponse?: unknown;
};

const getCachedMatches = unstable_cache(
  async (
    leagueCode: string,
    matchday: number | null,
    limit: number,
    from: number,
    to: number,
  ) => {
    const db = await getDb();
    const activeProvider = getFootballProvider().name;
    if (activeProvider === "sportsapi") {
      ensureSportsApiBackgroundService();
    }
    const query = {
      provider: activeProvider,
      // Only expose records written from a verified Football API response.
      rawApiResponse: { $exists: true },
      // 207 is Switzerland's Super League, not Turkey's Super Cup (551).
      $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }],
      status: { $nin: ["VOID", "CANCELLED"] },
      kickoffAt: { $gte: new Date(from), $lte: new Date(to) },
      ...(leagueCode ? { leagueCode } : {}),
      ...(matchday !== null ? { matchday } : {}),
    };
    let rows = await db
      .collection<MatchRecord>("matches")
      .find(query)
      .sort({ kickoffAt: 1 })
      .limit(limit)
      .toArray();

    if (rows.length === 0 && activeProvider === "sportsapi") {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        await getFootballProvider().syncDate(todayStr);
        rows = await db
          .collection<MatchRecord>("matches")
          .find(query)
          .sort({ kickoffAt: 1 })
          .limit(limit)
          .toArray();
      } catch (err) {
        console.error("[SportsAPI] Discovery on empty cached matches failed:", err);
      }
    }

    return rows;
  },
  ["lowblock-matches"],
  { revalidate: 60, tags: ["matches"] },
);

export const getLatestSeasonStartYear = unstable_cache(
  async () => {
    const db = await getDb();
    const latest = await db
      .collection<{ seasonStartYear?: number }>("matches")
      .findOne(
        {},
        { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } },
      );
    return Number(latest?.seasonStartYear ?? new Date().getUTCFullYear());
  },
  ["lowblock-latest-season"],
  { revalidate: 900, tags: ["matches", "seasons"] },
);

export async function getMatches(
  filters: { leagueCode?: string; matchday?: number; limit?: number } = {},
) {
  const now = Date.now();
  return getCachedMatches(
    filters.leagueCode ?? "",
    filters.matchday ?? null,
    filters.limit ?? 50,
    now - 24 * 60 * 60 * 1000,
    now + 14 * 864e5,
  );
}

export type MatchPageCursor = {
  globalPriority: 0 | 1;
  kickoffAt: string;
  providerMatchId: string;
};

function todayBounds() {
  const dateKey = new Date().toISOString().slice(0, 10);
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/**
 * A partially populated matches collection is not evidence that today's
 * SportsAPI discovery completed. In particular, one live match can exist
 * while the rest of the daily schedule is still missing. The persisted
 * discovery record is the source of truth and keeps this fallback to one
 * daily REST discovery instead of repeating it on every page request.
 */
async function ensureSportsApiTodayDiscovery(db: Awaited<ReturnType<typeof getDb>>) {
  if (getFootballProvider().name !== "sportsapi") return;

  const dateKey = new Date().toISOString().slice(0, 10);
  const discovery = await db
    .collection("sportsApiDailyFixtures")
    .findOne({ dateString: dateKey }, { projection: { dateString: 1 } });
  if (discovery) return;

  await getFootballProvider().syncDate(dateKey);
}

export async function getMatchesPage(
  limit = 30,
  cursor?: MatchPageCursor | null,
) {
  const db = await getDb();
  const bounds = todayBounds();
  if (!cursor) {
    try {
      await ensureSportsApiTodayDiscovery(db);
    } catch (err) {
      console.error("[SportsAPI] Daily discovery check failed:", err);
    }
  }
  const query: any = {
    provider: getFootballProvider().name,
    rawApiResponse: { $exists: true },
    $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }],
    status: { $nin: ["VOID", "CANCELLED"] },
    kickoffAt: { $gte: bounds.start, $lt: bounds.end },
  };
  const cursorKickoff = cursor ? new Date(cursor.kickoffAt) : null;
  if (cursor) {
    if (
      !cursorKickoff ||
      !Number.isFinite(cursorKickoff.getTime()) ||
      !cursor.providerMatchId
    )
      throw new Error("INVALID_MATCH_CURSOR");
    if (cursor.globalPriority !== 0 && cursor.globalPriority !== 1)
      throw new Error("INVALID_MATCH_CURSOR");
  }
  const pageSize = Math.min(Math.max(limit, 1), 50);
  const pipeline: any[] = [
    { $match: query },
    {
      $addFields: {
        globalPriority: {
          $cond: [
            {
              $or: [
                { $in: ["$leagueCode", GLOBAL_LEAGUE_CODES] },
                { $eq: ["$leagueCode", "FRIENDLY"] },
                {
                  $in: [
                    "$homeTeam.name",
                    IMPORTANT_NATIONAL_TEAM_NAMES,
                  ],
                },
                {
                  $in: [
                    "$awayTeam.name",
                    IMPORTANT_NATIONAL_TEAM_NAMES,
                  ],
                },
                {
                  $in: [
                    "$rawApiResponse.teams.home.name",
                    IMPORTANT_NATIONAL_TEAM_NAMES,
                  ],
                },
                {
                  $in: [
                    "$rawApiResponse.teams.away.name",
                    IMPORTANT_NATIONAL_TEAM_NAMES,
                  ],
                },
              ],
            },
            0,
            1,
          ],
        },
      },
    },
  ];
  if (cursor) {
    pipeline.push({
      $match: {
        $or: [
          { globalPriority: { $gt: cursor.globalPriority } },
          {
            globalPriority: cursor.globalPriority,
            kickoffAt: { $gt: cursorKickoff! },
          },
          {
            globalPriority: cursor.globalPriority,
            kickoffAt: cursorKickoff!,
            providerMatchId: { $gt: cursor.providerMatchId },
          },
        ],
      },
    });
  }
  pipeline.push(
    { $sort: { globalPriority: 1, kickoffAt: 1, providerMatchId: 1 } },
    { $limit: pageSize + 1 },
    { $project: { globalPriority: 0 } },
  );
  let matches = await db
    .collection<MatchRecord>("matches")
    .aggregate<MatchRecord>(pipeline)
    .toArray();

  const hasMore = matches.length > pageSize;
  const page = hasMore ? matches.slice(0, -1) : matches;
  const publicPage = page.map((match) => {
    const homeLogo = match.homeTeam.logoUrl || (match.homeTeam as any).logo || (match.homeTeam.id ? `/api/team-image/${match.homeTeam.id}` : null);
    const awayLogo = match.awayTeam.logoUrl || (match.awayTeam as any).logo || (match.awayTeam.id ? `/api/team-image/${match.awayTeam.id}` : null);

    return {
      provider: match.provider,
      providerMatchId: match.providerMatchId,
      leagueCode: match.leagueCode,
      matchday: match.matchday,
      kickoffAt: new Date(match.kickoffAt).toISOString(),
      status: match.status,
      elapsed: match.elapsed ?? null,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      homeTeam: {
        ...match.homeTeam,
        logo: homeLogo,
        logoUrl: homeLogo,
      },
      awayTeam: {
        ...match.awayTeam,
        logo: awayLogo,
        logoUrl: awayLogo,
      },
      seasonStartYear: match.seasonStartYear,
    };
  });
  const last = publicPage.at(-1);
  return {
    matches: publicPage,
    hasMore,
    nextCursor: last
      ? {
          globalPriority: (isFeaturedFixture(
            last.leagueCode,
            last.homeTeam.name,
            last.awayTeam.name,
          )
            ? 0
            : 1) as 0 | 1,
          kickoffAt: new Date(last.kickoffAt).toISOString(),
          providerMatchId: last.providerMatchId,
        }
      : null,
  };
}

export async function getMatch(providerMatchId: string) {
  const db = await getDb();
  return db.collection<MatchRecord>("matches").findOne({
    provider: getFootballProvider().name,
    providerMatchId,
    rawApiResponse: { $exists: true },
    $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }],
    status: { $nin: ["VOID", "CANCELLED"] },
  });
}

export async function getPredictions(matchIds: string[], userId = "guest") {
  if (!matchIds.length) return new Map();
  const db = await getDb();
  const rows = await db
    .collection<{ matchId: string; homeGoals: number; awayGoals: number }>(
      "predictions",
    )
    .find({ userId, matchId: { $in: matchIds } })
    .toArray();
  return new Map(rows.map((row) => [row.matchId, row]));
}
