import { getDb, closeMongo } from "../lib/db/mongo";

void (async () => {
  const db = await getDb();
  try {
    const leaderboardSort = { points: -1, exact: -1, correctOutcome: -1, globalPoints: -1, earliestPredictionAt: 1, predictions: -1, userId: 1 } as const;
    const reports: Record<string, unknown> = {
      matches: await db.collection("matches").find({ provider: "football-api", status: { $nin: ["VOID", "CANCELLED"] } }).sort({ kickoffAt: 1 }).limit(30).explain("executionStats"),
      leaderboardStats: await db.collection("leaderboardStats").find({ scope: "GLOBAL" }).sort(leaderboardSort).limit(20).explain("executionStats"),
      predictionScores: await db.collection("predictionScores").find({ seasonStartYear: new Date().getUTCFullYear() }).sort({ kickoffAt: 1 }).limit(20).explain("executionStats"),
      detailedLeaderboard: await db.collection("predictionScores").aggregate([
        { $match: { seasonStartYear: new Date().getUTCFullYear(), leagueCode: { $in: ["39", "2", "3", "848", "135", "78"] } } },
        { $group: { _id: "$userId", points: { $sum: "$points" }, predictions: { $sum: 1 }, exact: { $sum: { $cond: ["$exactScore", 1, 0] } }, correct: { $sum: { $cond: ["$correctOutcome", 1, 0] } } } },
      ]).explain("executionStats"),
    };
    const club = await db.collection<any>("clubs").findOne({}, { projection: { _id: 1 } });
    if (club) reports.clubLeaderboard = await db.collection("leaderboardStats").find({ scope: { $regex: `^CLUB:${String(club._id)}:` } }).sort(leaderboardSort).limit(20).explain("executionStats");
    const viewer = await db.collection<any>("leaderboardStats").findOne({ scope: "GLOBAL" }, { projection: { userId: 1, points: 1, exact: 1, correctOutcome: 1, globalPoints: 1, earliestPredictionAt: 1, predictions: 1 } });
    if (viewer) reports.currentUserRank = await db.collection("leaderboardStats").find({ scope: "GLOBAL", $or: [{ points: { $gt: viewer.points ?? 0 } }, { points: viewer.points ?? 0, exact: { $gt: viewer.exact ?? 0 } }, { points: viewer.points ?? 0, exact: viewer.exact ?? 0, correctOutcome: { $gt: viewer.correctOutcome ?? 0 } }, { points: viewer.points ?? 0, exact: viewer.exact ?? 0, correctOutcome: viewer.correctOutcome ?? 0, globalPoints: { $gt: viewer.globalPoints ?? 0 } }] }).explain("executionStats");
    for (const [name, report] of Object.entries(reports)) {
      const executionStats = (report as any).executionStats;
      const planner = (report as any).queryPlanner;
      console.log(JSON.stringify({ name, executionStats: executionStats ? { executionTimeMillis: executionStats.executionTimeMillis, nReturned: executionStats.nReturned, totalKeysExamined: executionStats.totalKeysExamined, totalDocsExamined: executionStats.totalDocsExamined } : undefined, winningPlan: planner?.winningPlan }, null, 2));
    }
  } finally {
    await closeMongo();
  }
})();
