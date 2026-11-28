import { unverifiedSeniorFriendlyRanges } from "@/lib/football/internationalWindows";
import { WOMENS_FIXTURE_MONGO_EXCLUSIONS, isSupportedMensFootballFixture } from "@/lib/football/fixtureEligibility";
import { getFootballProvider } from "@/lib/football/providerRegistry";
import { getDb } from "@/lib/db/mongo";
import { centralTeamLogo } from "./centralTeams";
import { nationalTeamCrestUrl } from "./teamLogos";
import { unstable_cache } from "next/cache";
import type { ProviderName } from "./types";
import {
  GLOBAL_LEAGUE_CODES,
  IMPORTANT_NATIONAL_TEAM_QUERY_NAMES,
  INTERNATIONAL_LEAGUE_CODES,
  isEligibleInternationalFixture,
  IMPORTANT_NATIONAL_TEAM_NAMES,
  isFeaturedFixture,
} from "@/lib/football/leagues";
import { appMatchesPageBounds } from "./scheduleWindow";

export type MatchRecord = {
  _id?: unknown;
  provider: ProviderName;
  providerMatchId: string;
  duplicateOf?: string;
  leagueCode: string;
  featuredNationalFixture?: boolean;
  matchday: number;
  kickoffAt: Date | string;
  status: string;
  elapsed?: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: { id: number; name: string; faName?: string; centralTeamId?: string; logoUrl: string | null };
  awayTeam: { id: number; name: string; faName?: string; centralTeamId?: string; logoUrl: string | null };
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
    const query = {
      provider: activeProvider,
      // Retained provider duplicates stay in storage for audit/prediction history,
      // but are excluded from public schedule and match detail surfaces.
      duplicateOf: { $exists: false },
      // Only expose records written from a verified Football API response.
      rawApiResponse: { $exists: true },
      // 207 is Switzerland's Super League, not Turkey's Super Cup (551).
      $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }, ...WOMENS_FIXTURE_MONGO_EXCLUSIONS],
      status: { $nin: ["VOID", "CANCELLED", "POSTPONED"] },
      kickoffAt: { $gte: new Date(from), $lte: new Date(to) },
      ...(leagueCode ? { leagueCode } : {}),
      ...(matchday !== null ? { matchday } : {}),
      $or: [
        { featuredNationalFixture: true },
        { leagueCode: { $nin: INTERNATIONAL_LEAGUE_CODES } },
        { "homeTeam.name": { $in: IMPORTANT_NATIONAL_TEAM_QUERY_NAMES } },
        { "awayTeam.name": { $in: IMPORTANT_NATIONAL_TEAM_QUERY_NAMES } },
      ],
    };
    let rows = await db
      .collection<MatchRecord>("matches")
      .find(query)
      .sort({ kickoffAt: 1 })
      .limit(Math.max(limit * 3, 100))
      .toArray();
    rows = rows
      .filter((row) =>
        isSupportedMensFootballFixture(row) && (
        row.featuredNationalFixture === true ||
        isEligibleInternationalFixture(
          row.leagueCode,
          row.homeTeam.name,
          row.awayTeam.name,
        )),
      )
      .slice(0, limit);

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
  return appMatchesPageBounds();
}

async function getMatchesPageUncached(
  limit = 30,
  cursor?: MatchPageCursor | null,
  options: { upcomingOnly?: boolean; unpredictedFor?: string } = {},
) {
  const db = await getDb();
  const bounds = todayBounds();
  const query: any = {
    provider: getFootballProvider().name,
    duplicateOf: { $exists: false },
    rawApiResponse: { $exists: true },
    $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }, ...WOMENS_FIXTURE_MONGO_EXCLUSIONS],
    status: { $nin: ["VOID", "CANCELLED", "POSTPONED"] },
    kickoffAt: { $gte: bounds.start, $lt: bounds.end },
    $or: [
      { featuredNationalFixture: true },
      { leagueCode: { $nin: INTERNATIONAL_LEAGUE_CODES } },
      { "homeTeam.name": { $in: IMPORTANT_NATIONAL_TEAM_QUERY_NAMES } },
      { "awayTeam.name": { $in: IMPORTANT_NATIONAL_TEAM_QUERY_NAMES } },
    ],
  };
  // Existing provider records can predate today's FIFA calendar validation.
  // Exclude them before pagination so they cannot occupy a visible match slot.
  for (const range of unverifiedSeniorFriendlyRanges(bounds.start, bounds.end)) {
    query.$nor.push({
      leagueCode: { $in: ["FRIENDLY", "INTL_OTHER"] },
      kickoffAt: { $gte: range.start, $lt: range.end },
    });
  }
  // Apply eligibility before pagination so finished/already-predicted fixtures
  // cannot consume the home feed's first page.
  if (options.upcomingOnly) {
    query.status = "SCHEDULED";
    query.kickoffAt.$gt = new Date();
  }
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
                { $eq: ["$featuredNationalFixture", true] },
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
  if (options.unpredictedFor) {
    pipeline.push(
      { $lookup: {
        from: "predictions",
        let: { matchId: "$providerMatchId" },
        pipeline: [
          { $match: { userId: options.unpredictedFor, $expr: { $eq: ["$matchId", "$$matchId"] } } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "viewerPredictions",
      } },
      { $match: { "viewerPredictions.0": { $exists: false } } },
      { $project: { viewerPredictions: 0 } },
    );
  }
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
  const centralIds = [...new Set(page.flatMap((match) => [match.homeTeam.centralTeamId, match.awayTeam.centralTeamId]).filter(Boolean))];
  const centralRows = centralIds.length
    ? await db.collection<any>("centralTeams").find({ centralTeamId: { $in: centralIds } }, { projection: { centralTeamId: 1, "names.fa": 1, "names.en": 1, isNational: 1, logoUrl: 1, providerIds: 1 } }).toArray()
    : [];
  const centralFa = new Map(centralRows.map((row) => [row.centralTeamId, row.names?.fa]));
  const centralLogos = new Map(centralRows.map((row) => [row.centralTeamId, centralTeamLogo(row)]));
  const publicPage = page.map((match) => {
    const isInternational = INTERNATIONAL_LEAGUE_CODES.includes(match.leagueCode);
    const homeLogo = isInternational
      ? nationalTeamCrestUrl(match.homeTeam.name)
      : (centralLogos.get(match.homeTeam.centralTeamId) || null);
    const awayLogo = isInternational
      ? nationalTeamCrestUrl(match.awayTeam.name)
      : (centralLogos.get(match.awayTeam.centralTeamId) || null);

    return {
      provider: match.provider,
      providerMatchId: match.providerMatchId,
      leagueCode: match.leagueCode,
      featuredNationalFixture: match.featuredNationalFixture === true,
      matchday: match.matchday,
      kickoffAt: new Date(match.kickoffAt).toISOString(),
      status: match.status,
      elapsed: match.elapsed ?? null,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      homeTeam: {
        ...match.homeTeam,
        faName: centralFa.get(match.homeTeam.centralTeamId) || match.homeTeam.faName,
        logo: homeLogo,
        logoUrl: homeLogo,
      },
      awayTeam: {
        ...match.awayTeam,
        faName: centralFa.get(match.awayTeam.centralTeamId) || match.awayTeam.faName,
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

/**
 * All users share the public fixture list. Cache that common list briefly,
 * but never cache user-specific prediction exclusions or private predictions
 * as public data. Scoring/lock validation always uses authoritative records.
 */
const getCachedPublicMatchesPage = unstable_cache(
  (limit: number, cursor: MatchPageCursor | null, upcomingOnly: boolean) =>
    getMatchesPageUncached(limit, cursor, { upcomingOnly }),
  ["public-matches-page-v1"],
  { revalidate: 15, tags: ["matches"] },
);

export async function getMatchesPage(
  limit = 30,
  cursor?: MatchPageCursor | null,
  options: { upcomingOnly?: boolean; unpredictedFor?: string } = {},
) {
  if (options.unpredictedFor)
    return getMatchesPageUncached(limit, cursor, options);
  return getCachedPublicMatchesPage(limit, cursor ?? null, Boolean(options.upcomingOnly));
}

export async function getMatch(providerMatchId: string) {
  const db = await getDb();
  const match = await db.collection<MatchRecord>("matches").findOne({
    provider: getFootballProvider().name,
    providerMatchId,
    duplicateOf: { $exists: false },
    rawApiResponse: { $exists: true },
    $nor: [{ leagueCode: "TR_SC", "rawApiResponse.league.id": 207 }, ...WOMENS_FIXTURE_MONGO_EXCLUSIONS],
    status: { $nin: ["VOID", "CANCELLED", "POSTPONED"] },
  });
  // Type-narrow the nullable DB row before applying the gender guard.
  if (!match || !isSupportedMensFootballFixture(match)) return null;
  const ids = [match.homeTeam.centralTeamId, match.awayTeam.centralTeamId].filter(Boolean);
  const rows = ids.length
    ? await db.collection<any>("centralTeams").find({ centralTeamId: { $in: ids } }, { projection: { centralTeamId: 1, "names.fa": 1, "names.en": 1, isNational: 1, logoUrl: 1, providerIds: 1 } }).toArray()
    : [];
  const fa = new Map(rows.map((row) => [row.centralTeamId, row.names?.fa]));
  const logos = new Map(rows.map((row) => [row.centralTeamId, centralTeamLogo(row)]));
  const international = INTERNATIONAL_LEAGUE_CODES.includes(match.leagueCode);
  const homeLogo = international ? nationalTeamCrestUrl(match.homeTeam.name) : (logos.get(match.homeTeam.centralTeamId) || null);
  const awayLogo = international ? nationalTeamCrestUrl(match.awayTeam.name) : (logos.get(match.awayTeam.centralTeamId) || null);
  return {
    ...match,
    homeTeam: { ...match.homeTeam, faName: fa.get(match.homeTeam.centralTeamId) || match.homeTeam.faName, logo: homeLogo, logoUrl: homeLogo },
    awayTeam: { ...match.awayTeam, faName: fa.get(match.awayTeam.centralTeamId) || match.awayTeam.faName, logo: awayLogo, logoUrl: awayLogo },
  };
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
