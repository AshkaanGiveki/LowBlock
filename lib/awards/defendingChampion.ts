import type { Db } from "mongodb";
import { getIranWeeklyPeriod } from "@/lib/domain/leaderboardPeriods";
import { leaderboardPublicationKey } from "@/lib/domain/leaderboardPublications";

/**
 * The defending champion is the previous week's top global predictor.
 * This is a snapshot-backed read, never a full score-to-fixture join.
 */
export async function getDefendingChampionUserId(db: Db) {
  const period = getIranWeeklyPeriod(new Date(), 1);
  const publishedKey = leaderboardPublicationKey({ weekly: true, weeklyOffset: 1 });
  if (publishedKey) {
    const published = await db.collection<any>("leaderboardPublications")
      .findOne({ _id: publishedKey }, { projection: { rows: { $slice: 1 } } });
    if (published && Array.isArray(published.rows))
      return published.rows[0]?.userId ? String(published.rows[0].userId) : null;
  }

  // Initial deployment / missing publication: filter the indexed ledger field
  // directly. Previously every ranking request joined ALL scored predictions
  // against the matches collection to identify one previous-week winner.
  const [leader] = await db.collection("predictionScores").aggregate([
    { $match: {
      kickoffAt: { $gte: period.start, $lt: period.end },
      globalEligible: true,
    } },
    { $group: {
      _id: "$userId",
      points: { $sum: "$points" },
      exact: { $sum: { $cond: ["$exactScore", 1, 0] } },
      correctOutcome: { $sum: { $cond: ["$correctOutcome", 1, 0] } },
      predictions: { $sum: 1 },
      earliestPredictionAt: { $min: "$predictionCreatedAt" },
    } },
    { $sort: {
      points: -1,
      exact: -1,
      correctOutcome: -1,
      earliestPredictionAt: 1,
      predictions: -1,
      _id: 1,
    } },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ]).toArray();
  return leader?._id ? String(leader._id) : null;
}
