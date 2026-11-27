import { closeMongo, getDb } from "../lib/db/mongo";
import { refreshH2HTeamRatings } from "../lib/domain/h2hRatingEngine";
import { H2H_STRENGTH_VERSION } from "../lib/domain/h2hTeamStrength";

/**
 * Historical compatibility: the old command imported 433 hand-picked scores
 * from a static file and could silently overwrite the 1,402-team calibration.
 * It now uses the same source of truth as the nightly worker.
 */
async function main() {
  const db = await getDb();
  const result = await refreshH2HTeamRatings(db, { force: true });
  const missing = await db.collection("centralTeams").countDocuments({
    centralTeamId: { $exists: true },
    h2hRatingVersion: { $ne: H2H_STRENGTH_VERSION },
  });
  const count = await db.collection("centralTeams").countDocuments({
    centralTeamId: { $exists: true },
  });
  console.info(JSON.stringify({
    type: "lowblock.h2h.manual_rating_sync",
    version: H2H_STRENGTH_VERSION,
    count, missing, result,
  }));
  if (missing > 0) throw new Error("H2H_MANUAL_RATING_SYNC_INCOMPLETE");
}

main().catch((error) => {
  console.error("H2H_MANUAL_RATING_SYNC_FAILED",
    error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => closeMongo());
