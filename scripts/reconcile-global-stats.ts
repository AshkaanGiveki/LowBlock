import type { Db, ClientSession } from "mongodb";
import { getDb, closeMongo, withMongoTransaction } from "../lib/db/mongo";

type Expected = {
  userId: string;
  points: number;
  predictions: number;
  exact: number;
  correctOutcome: number;
  earliestPredictionAt?: Date | null;
};
type Difference = { expected: Expected; current: any };

async function computeDifferences(db: Db, session?: ClientSession) {
  const rows = await db.collection<any>("predictionScores").aggregate([
    { $match: { globalEligible: true } },
    { $group: {
      _id: "$userId",
      points: { $sum: "$points" },
      predictions: { $sum: 1 },
      exact: { $sum: { $cond: ["$exactScore", 1, 0] } },
      correctOutcome: { $sum: { $cond: ["$correctOutcome", 1, 0] } },
      earliestPredictionAt: { $min: "$predictionCreatedAt" },
    } },
  ], { session }).toArray();
  const originals = await db.collection<any>("leaderboardStats")
    .find({ scope: "GLOBAL" }, { session }).toArray();
  const existing = new Map(originals.map((row) => [String(row.userId), row]));
  const changes: Difference[] = [];
  for (const row of rows) {
    const expected: Expected = {
      userId: String(row._id),
      points: Number(row.points),
      predictions: Number(row.predictions),
      exact: Number(row.exact),
      correctOutcome: Number(row.correctOutcome),
      earliestPredictionAt: row.earliestPredictionAt ?? null,
    };
    const current = existing.get(expected.userId);
    if (
      !current ||
      Number(current.points) !== expected.points ||
      Number(current.predictions) !== expected.predictions ||
      Number(current.exact) !== expected.exact ||
      Number(current.correctOutcome) !== expected.correctOutcome
    ) changes.push({ expected, current });
  }
  const validUserIds = new Set(rows.map((row) => String(row._id)));
  const orphanCount = originals.filter((row) => !validUserIds.has(String(row.userId))).length;
  return { changes, orphanCount };
}

async function main() {
  const db = await getDb();
  const apply = process.argv.includes("--apply");
  if (apply && process.env.ALLOW_LEADERBOARD_STATS_REPAIR !== "yes")
    throw new Error("Repair requires ALLOW_LEADERBOARD_STATS_REPAIR=yes and --apply");
  const report = await computeDifferences(db);
  const summary = {
    mode: apply ? "REPAIR" : "DRY_RUN",
    mismatchingUserCount: report.changes.length,
    orphanedGlobalRecords: report.orphanCount,
    pointsDelta: report.changes.reduce((n, row) =>
      n + row.expected.points - Number(row.current?.points ?? 0), 0),
    predictionDelta: report.changes.reduce((n, row) =>
      n + row.expected.predictions - Number(row.current?.predictions ?? 0), 0),
  };
  console.info(JSON.stringify({ type: "global_stats_reconciliation_plan", ...summary }));
  if (!apply) return;
  if (report.orphanCount)
    throw new Error("Refusing automatic repair when orphaned Global stats exist");
  if (report.changes.length > 1000)
    throw new Error("Refusing unexpected bulk repair of more than 1000 player rows");
  if (!report.changes.length) return;

  await withMongoTransaction(async (transactionDb, session) => {
    const fresh = await computeDifferences(transactionDb, session);
    if (fresh.orphanCount ||
        fresh.changes.length !== report.changes.length ||
        fresh.changes.some((entry) =>
          !report.changes.some((original) => original.expected.userId === entry.expected.userId)))
      throw new Error("Global stat drift changed during the repair; abort and retry");

    const updatedAt = new Date();
    for (const { expected } of fresh.changes) {
      await transactionDb.collection<any>("leaderboardStats").updateOne(
        { userId: expected.userId, scope: "GLOBAL" },
        {
          $set: {
            points: expected.points,
            predictions: expected.predictions,
            exact: expected.exact,
            correctOutcome: expected.correctOutcome,
            globalPoints: expected.points,
            totalPoints: expected.points,
            predictionCount: expected.predictions,
            exactScores: expected.exact,
            earliestPredictionAt: expected.earliestPredictionAt,
            updatedAt,
          },
          $setOnInsert: { userId: expected.userId, scope: "GLOBAL" },
        },
        { upsert: true, session },
      );
      await transactionDb.collection<any>("leaderboardStats").updateMany(
        { userId: expected.userId, scope: { $ne: "GLOBAL" } },
        { $set: { globalPoints: expected.points } },
        { session },
      );
    }
  });
  const after = await computeDifferences(db);
  console.info(JSON.stringify({
    type: "global_stats_reconciliation_result",
    repaired: report.changes.length,
    remainingMismatches: after.changes.length,
    orphanedGlobalRecords: after.orphanCount,
  }));
  if (after.changes.length || after.orphanCount)
    throw new Error("Global aggregates remain inconsistent after repair");
}

main().catch((error) => {
  console.error("Global stats reconciliation failed:", error instanceof Error ? error.message : "unknown");
  process.exitCode = 1;
}).finally(() => closeMongo());
