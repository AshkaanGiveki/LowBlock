import { ObjectId, type Db } from "mongodb";
import { withMongoTransaction } from "@/lib/db/mongo";
import { getCanonicalLeaderboard, type LeaderboardScope } from "@/lib/domain/leaderboards";
import {
  clubPublicationPolicy,
  leaderboardPublicationKey,
  MAX_PUBLISHED_ROWS,
} from "@/lib/domain/leaderboardPublications";
import { DEFAULT_CLUB_LEAGUE_CODES } from "@/lib/football/leagues";

type ScoredFixture = {
  userId?: string;
  leagueCode?: string;
  seasonStartYear?: number;
  clubIdAtLock?: string | null;
  globalEligible?: boolean;
};

/**
 * Build bounded, read-only standings after a successful score pass.
 * Reads never rebuild these publications. Generate first, then atomically
 * publish all documents together, leaving old snapshots intact on failure.
 */
export async function publishLeaderboardSnapshots(
  db: Db,
  options: { updatedMatchIds?: string[]; full?: boolean } = {},
) {
  const full = options.full === true;
  const matchIds = [...new Set(options.updatedMatchIds ?? [])].filter(Boolean);
  const changedScores: ScoredFixture[] = [];
  for (let index = 0; index < matchIds.length; index += 100) {
    const batch = await db.collection<ScoredFixture>("predictionScores").find(
      { matchId: { $in: matchIds.slice(index, index + 100) } },
      { projection: {
        userId: 1, leagueCode: 1, seasonStartYear: 1,
        clubIdAtLock: 1, globalEligible: 1,
      } },
    ).toArray();
    changedScores.push(...batch);
  }

  const targets = new Map<string, LeaderboardScope>();
  function add(scope: LeaderboardScope) {
    const key = leaderboardPublicationKey(scope);
    if (key) targets.set(key, scope);
  }
  const years = new Set<number>();
  const editions = new Set<string>();
  const clubs = new Set<string>();
  for (const row of changedScores) {
    if (row.seasonStartYear != null && Number.isFinite(Number(row.seasonStartYear)))
      years.add(Number(row.seasonStartYear));
    if (row.leagueCode && row.seasonStartYear != null)
      editions.add(`${row.leagueCode}:${row.seasonStartYear}`);
    if (row.clubIdAtLock && ObjectId.isValid(row.clubIdAtLock))
      clubs.add(String(row.clubIdAtLock));
  }

  if (full) {
    const [seasonYears, allEditions, allClubs] = await Promise.all([
      db.collection("predictionScores").distinct("seasonStartYear"),
      db.collection<any>("predictionScores").aggregate([
        { $group: { _id: { leagueCode: "$leagueCode", year: "$seasonStartYear" } } },
      ]).toArray(),
      db.collection("clubs").find({}, { projection: { _id: 1 } }).toArray(),
    ]);
    for (const year of seasonYears)
      if (Number.isFinite(Number(year))) years.add(Number(year));
    for (const row of allEditions)
      if (row._id?.leagueCode && row._id?.year != null)
        editions.add(`${row._id.leagueCode}:${row._id.year}`);
    for (const club of allClubs)
      if (club._id && ObjectId.isValid(String(club._id))) clubs.add(String(club._id));
  }

  // These two are always needed: a new week can start with no scored games.
  add({ weekly: true });
  add({ weekly: true, weeklyOffset: 1 });
  if (full || changedScores.some((row) => row.globalEligible)) {
    add({});
    for (const year of years) add({ seasonStartYear: year });
  }
  for (const clubId of clubs) {
    add({ clubId, weekly: true });
    add({ clubId, weekly: true, weeklyOffset: 1 });
    add({ clubId });
    for (const year of years) add({ clubId, seasonStartYear: year });
  }
  for (const edition of editions) {
    const sep = edition.lastIndexOf(":");
    const leagueCode = edition.slice(0, sep);
    const seasonStartYear = Number(edition.slice(sep + 1));
    if (leagueCode && Number.isFinite(seasonStartYear))
      add({ leagueCode, seasonStartYear });
  }

  const keys = [...targets.keys()];
  if (!keys.length) return { published: 0, skipped: 0 };
  const existing = await db.collection("leaderboardPublications")
    .find({ _id: { $in: keys } }, { projection: { _id: 1 } }).toArray();
  const existingKeys = new Set(existing.map((doc) => String(doc._id)));
  const affectedGlobal = full || changedScores.some((row) => row.globalEligible);
  const changedClubIds = new Set(changedScores.map((r) => String(r.clubIdAtLock ?? "")));
  const changedEditions = new Set(changedScores
    .filter((r) => r.leagueCode && r.seasonStartYear != null)
    .map((r) => `${r.leagueCode}:${r.seasonStartYear}`));
  const selected = [...targets.entries()].filter(([key, scope]) => {
    if (full || !existingKeys.has(key)) return true;
    if (scope.clubId) return changedClubIds.has(scope.clubId);
    if (scope.leagueCode) return changedEditions.has(`${scope.leagueCode}:${scope.seasonStartYear}`);
    return affectedGlobal;
  });

  const clubIds = [...new Set(selected.map(([, scope]) => scope.clubId).filter(Boolean) as string[])];
  const clubDocs = clubIds.length
    ? await db.collection<any>("clubs").find(
        { _id: { $in: clubIds.map((id) => new ObjectId(id)) } },
        { projection: { leaderboardCompetitionCodes: 1 } },
      ).toArray()
    : [];
  const policies = new Map<string, string>(clubDocs.map((club) => [
    String(club._id),
    clubPublicationPolicy(Array.isArray(club.leaderboardCompetitionCodes)
      ? club.leaderboardCompetitionCodes : DEFAULT_CLUB_LEAGUE_CODES),
  ]));

  const now = new Date();
  const writes: any[] = [];
  for (const [key, scope] of selected) {
    if (scope.clubId && !policies.has(scope.clubId)) continue;
    // Force an authoritative computation; never build a publication by reading
    // an older publication or a partially materialized legacy scope.
    const rows = await getCanonicalLeaderboard(db, scope, MAX_PUBLISHED_ROWS, undefined, true);
    writes.push({
      updateOne: {
        filter: { _id: key },
        update: {
          $set: {
            rows,
            rowLimit: MAX_PUBLISHED_ROWS,
            policyKey: scope.clubId ? policies.get(scope.clubId) : null,
            publishedAt: now,
            version: 1,
          },
        },
        upsert: true,
      },
    });
  }
  if (writes.length) {
    await withMongoTransaction(async (transactionDb, session) => {
      for (let index = 0; index < writes.length; index += 25) {
        await transactionDb.collection("leaderboardPublications")
          .bulkWrite(writes.slice(index, index + 25), { ordered: false, session });
      }
    });
  }
  console.info(JSON.stringify({
    type: "lowblock.leaderboard_publication",
    mode: full ? "full" : "incremental",
    changedMatchCount: matchIds.length,
    published: writes.length,
    skipped: keys.length - writes.length,
    at: now.toISOString(),
  }));
  return { published: writes.length, skipped: keys.length - writes.length };
}
