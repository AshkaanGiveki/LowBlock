import { getDb, closeMongo } from "../lib/db/mongo";
import { refreshH2HTeamRatings } from "../lib/domain/h2hRatingEngine";
import { H2H_STRENGTH_VERSION } from "../lib/domain/h2hTeamStrength";

async function main() {
  const db = await getDb();
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  if (apply && process.env.ALLOW_H2H_TEAM_RATING_REBUILD !== "yes")
    throw new Error("H2H strength rebuild requires ALLOW_H2H_TEAM_RATING_REBUILD=yes and --apply");
  const count = await db.collection("centralTeams").countDocuments({ centralTeamId: { $exists: true } });
  if (!apply) {
    const [already, old, unrated] = await Promise.all([
      db.collection("centralTeams").countDocuments({ h2hRatingVersion: H2H_STRENGTH_VERSION }),
      db.collection("centralTeams").countDocuments({ h2hRating: { $gt: 0 } }),
      db.collection("centralTeams").countDocuments({
        centralTeamId: { $exists: true },
        h2hRatingVersion: { $ne: H2H_STRENGTH_VERSION },
      }),
    ]);
    console.log(JSON.stringify({
      type: "lowblock.h2h.team_rating_preflight",
      operation: "READ_ONLY", total: count, existingVersion: already,
      oldPositiveRatings: old, requiresCalibration: unrated,
      strengthVersion: H2H_STRENGTH_VERSION,
    }));
    return;
  }
  const changed = await refreshH2HTeamRatings(db, { force });
  const [updated, missing, invalid, example] = await Promise.all([
    db.collection("centralTeams").countDocuments({ h2hRatingVersion: H2H_STRENGTH_VERSION }),
    db.collection("centralTeams").countDocuments({
      centralTeamId: { $exists: true },
      h2hRatingVersion: { $ne: H2H_STRENGTH_VERSION },
    }),
    db.collection("centralTeams").countDocuments({
      centralTeamId: { $exists: true },
      $nor: [{
        h2hRating: { $gte: 35, $lte: 95 },
        h2hRatingConfidence: { $gte: 0.2, $lte: 0.95 },
      }],
    }),
    db.collection<any>("centralTeams").find(
      { h2hRatingVersion: H2H_STRENGTH_VERSION },
      { projection: { centralTeamId: 1, h2hRating: 1, h2hRatingConfidence: 1 } },
    ).limit(3).toArray(),
  ]);
  console.log(JSON.stringify({
    type: "lowblock.h2h.team_rating_result",
    changed, total: count, updated, missing, invalid, example: example.map((x: any) => ({
      rating: x.h2hRating, confidence: x.h2hRatingConfidence,
    })),
  }));
  if (updated !== count || missing !== 0 || invalid !== 0)
    throw new Error("H2H_TEAM_RATING_CALIBRATION_INCOMPLETE");
}

main().catch(error => {
  console.error("H2H_TEAM_RATING_REBUILD_FAILED:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(closeMongo);
