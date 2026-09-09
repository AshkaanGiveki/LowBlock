import { closeMongo, ensurePerformanceIndexes, getDb } from "../lib/db/mongo";

void (async () => {
  try {
    await ensurePerformanceIndexes();
    const db = await getDb();
    const indexes = await Promise.all([
      db.collection("leaderboardStats").indexes(),
      db.collection("predictionScores").indexes(),
      db.collection("matches").indexes(),
    ]);
    console.log(
      JSON.stringify(
        {
          database: db.databaseName,
          leaderboardStats: indexes[0].map((index) => index.name),
          predictionScores: indexes[1].map((index) => index.name),
          matches: indexes[2].map((index) => index.name),
        },
        null,
        2,
      ),
    );
  } finally {
    await closeMongo();
  }
})();
