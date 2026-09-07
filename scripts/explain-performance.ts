import { getDb, closeMongo } from "../lib/db/mongo";

void (async () => {
  const db = await getDb();
  try {
    const reports = {
      matches: await db.collection("matches").find({ provider: "football-api", status: { $nin: ["VOID", "CANCELLED"] } }).sort({ kickoffAt: 1 }).limit(30).explain("executionStats"),
      leaderboardStats: await db.collection("leaderboardStats").find({ scope: "GLOBAL" }).sort({ points: -1, exact: -1, correctOutcome: -1, globalPoints: -1, earliestPredictionAt: 1, predictions: -1, userId: 1 }).limit(20).explain("executionStats"),
      predictionScores: await db.collection("predictionScores").find({ seasonStartYear: new Date().getUTCFullYear() }).sort({ kickoffAt: 1 }).limit(20).explain("executionStats"),
    };
    for (const [name, report] of Object.entries(reports)) console.log(JSON.stringify({ name, executionStats: (report as any).executionStats, queryPlanner: (report as any).queryPlanner }, null, 2));
  } finally {
    await closeMongo();
  }
})();
