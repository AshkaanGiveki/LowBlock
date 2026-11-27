import type { Db } from "mongodb";
import {
  calibrateH2HTeamRatings,
  H2H_STRENGTH_VERSION,
  type ResultMatch,
  type TeamRatingInput,
} from "@/lib/domain/h2hTeamStrength";

export async function refreshH2HTeamRatings(
  db: Db,
  options: { force?: boolean } = {},
) {
  const state = db.collection<any>("h2hTeamRatingState");
  const priorRun = await state.findOne({ _id: "strength" });
  if (!options.force && priorRun?.updatedAt &&
      Date.now() - new Date(priorRun.updatedAt).getTime() < 12 * 60 * 60_000)
    return { skipped: true, reason: "fresh_calibration", version: H2H_STRENGTH_VERSION };
  const [teams, matches] = await Promise.all([
    db.collection<any>("centralTeams").find({ centralTeamId: { $exists: true } },
      { projection: { centralTeamId: 1, h2hRating: 1, h2hRatingVersion: 1,
        h2hLegacyRating: 1, isNational: 1, currentLeagueCodes: 1, names: 1 } }).toArray(),
    db.collection<any>("matches").find(
      { kickoffAt: { $gte: new Date(Date.now() - 365 * 86_400_000) } },
      { projection: { leagueCode: 1, kickoffAt: 1, status: 1, homeGoals: 1,
        awayGoals: 1, duplicateOf: 1,
        "homeTeam.centralTeamId": 1, "awayTeam.centralTeamId": 1 } },
    ).toArray(),
  ]);
  if (teams.length === 0) throw new Error("H2H_RATING_NO_CANONICAL_TEAMS");
  const calibrated = calibrateH2HTeamRatings(
    teams as TeamRatingInput[], matches as ResultMatch[], new Date(),
  );
  if (calibrated.length !== teams.length)
    throw new Error("H2H_RATING_MISSING_TEAM_IDENTITIES");
  const byId = new Map(teams.map(team => [String(team.centralTeamId), team]));
  const now = new Date();
  const updates = calibrated.filter(row => {
    const old = byId.get(row.centralTeamId);
    return !old || old.h2hRatingVersion !== H2H_STRENGTH_VERSION ||
      !Number.isFinite(old.h2hRating) ||
      Math.abs(Number(old.h2hRating) - row.rating) >= 0.1 ||
      Math.abs(Number(old.h2hRatingConfidence ?? 0) - row.confidence) >= 0.01 ||
      Number(old.h2hRatedMatchCount ?? -1) !== row.matchesUsed;
  }).map(row => {
    const old = byId.get(row.centralTeamId);
    const firstCalibration = old?.h2hRatingVersion !== H2H_STRENGTH_VERSION;
    return { updateOne: {
      filter: { centralTeamId: row.centralTeamId },
      update: {
        $set: {
          h2hRating: row.rating,
          h2hRatingConfidence: row.confidence,
          h2hRatedMatchCount: row.matchesUsed,
          h2hRatingPrior: row.prior,
          h2hRatingVersion: H2H_STRENGTH_VERSION,
          h2hRatingUpdatedAt: now,
          ...(firstCalibration ? { h2hLegacyRating: row.legacyRating } : {}),
        },
      },
    } };
  });
  const col = db.collection<any>("centralTeams");
  for (let index = 0; index < updates.length; index += 100)
    await col.bulkWrite(updates.slice(index, index + 100), { ordered: false });
  await state.updateOne({ _id: "strength" }, {
    $set: {
      version: H2H_STRENGTH_VERSION,
      updatedAt: now,
      ratedTeams: calibrated.length,
      updatedTeams: updates.length,
      finishedFixtureCount: matches.filter(m => m.status === "FINISHED").length,
      zeroSampleTeams: calibrated.filter(x => x.matchesUsed === 0).length,
    },
  }, { upsert: true });
  const summary = {
    version: H2H_STRENGTH_VERSION,
    ratedTeams: calibrated.length,
    updatedTeams: updates.length,
    zeroSampleTeams: calibrated.filter(x => x.matchesUsed === 0).length,
    finishedFixtureCount: matches.filter(m => m.status === "FINISHED").length,
  };
  console.info(JSON.stringify({ type: "lowblock.h2h.rating_calibrated", ...summary }));
  return summary;
}
