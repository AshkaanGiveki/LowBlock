import { closeMongo, getDb } from "../lib/db/mongo";
import { getCanonicalLeaderboard, type LeaderboardScope } from "../lib/domain/leaderboards";
import { leaderboardPublicationKey, MAX_PUBLISHED_ROWS } from "../lib/domain/leaderboardPublications";

/**
 * Read-only reconciliation of published rankings against the canonical scoring
 * ledger. Run after first publication and periodically outside peak hours.
 */
async function main() {
  const db = await getDb();
  const scopes: LeaderboardScope[] = [
    { weekly: true },
    { weekly: true, weeklyOffset: 1 },
    {},
  ];

  const years = (await db.collection("predictionScores").distinct("seasonStartYear"))
    .map(Number).filter(Number.isFinite).sort((a, b) => b - a);
  if (years.length) scopes.push({ seasonStartYear: years[0] });
  const clubs = await db.collection("clubs")
    .find({}, { projection: { _id: 1 } }).limit(3).toArray();
  for (const club of clubs) {
    const clubId = String(club._id);
    scopes.push({ clubId, weekly: true }, { clubId });
    if (years.length) scopes.push({ clubId, seasonStartYear: years[0] });
  }
  const editions = await db.collection<any>("predictionScores").aggregate([
    { $group: { _id: { leagueCode: "$leagueCode", year: "$seasonStartYear" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]).toArray();
  for (const edition of editions) {
    const year = Number(edition._id?.year);
    if (edition._id?.leagueCode && Number.isFinite(year))
      scopes.push({ leagueCode: edition._id.leagueCode, seasonStartYear: year });
  }

  let verified = 0;
  const failures: string[] = [];
  for (const scope of scopes) {
    const key = leaderboardPublicationKey(scope);
    if (!key) continue;
    const published = await db.collection<any>("leaderboardPublications").findOne(
      { _id: key }, { projection: { rows: 1, publishedAt: 1 } },
    );
    if (!published || !Array.isArray(published.rows)) {
      failures.push(`${key}: missing snapshot`);
      continue;
    }
    const canonical = await getCanonicalLeaderboard(
      db, scope, MAX_PUBLISHED_ROWS, undefined, true,
    );
    const rows = published.rows as Array<any>;
    if (rows.length !== canonical.length) {
      failures.push(`${key}: length ${rows.length} != ${canonical.length}`);
      continue;
    }
    const fields = ["userId", "rank", "points", "exact", "correctOutcome", "predictions"];
    const mismatch = canonical.findIndex((expected, index) =>
      fields.some((field) => String((rows[index] as any)?.[field] ?? "") !==
        String((expected as any)[field] ?? "")),
    );
    if (mismatch >= 0) failures.push(`${key}: mismatch at rank ${mismatch + 1}`);
    else verified++;
  }
  console.log(JSON.stringify({
    type: "lowblock.leaderboard_reconciliation",
    checked: scopes.length,
    verified,
    failures,
    at: new Date().toISOString(),
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("leaderboard reconciliation failed:", error);
    process.exitCode = 1;
  })
  .finally(() => closeMongo());
