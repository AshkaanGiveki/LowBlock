import type { Db } from "mongodb";
import { GLOBAL_LEAGUE_CODES } from "@/lib/football/leagues";
import { getIranWeeklyPeriod } from "@/lib/domain/leaderboardPeriods";

export async function getDefendingChampionUserId(db: Db) {
  // The throne badge represents the player who finished first on the previous
  // weekly leaderboard. It must use the same Friday-to-Thursday period and
  // tie-break order as the public "Previous week" leaderboard.
  const period = getIranWeeklyPeriod(new Date(), 1);
  const [leader] = await db
    .collection("predictionScores")
    .aggregate([
      {
        $lookup: {
          from: "matches",
          localField: "matchId",
          foreignField: "providerMatchId",
          as: "fixture",
        },
      },
      { $unwind: "$fixture" },
      {
        $match: {
          "fixture.kickoffAt": { $gte: period.start, $lt: period.end },
          globalEligible: true,
          leagueCode: { $in: GLOBAL_LEAGUE_CODES },
        },
      },
      {
        $group: {
          _id: "$userId",
          points: { $sum: "$points" },
          exact: { $sum: { $cond: ["$exactScore", 1, 0] } },
          correctOutcome: { $sum: { $cond: ["$correctOutcome", 1, 0] } },
          predictions: { $sum: 1 },
        },
      },
      {
        $sort: {
          points: -1,
          exact: -1,
          predictions: -1,
          _id: 1,
        },
      },
      { $limit: 1 },
      { $project: { _id: 1 } },
    ])
    .toArray();
  return leader?._id ? String(leader._id) : null;
}
