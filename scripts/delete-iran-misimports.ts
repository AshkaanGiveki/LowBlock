import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

if (existsSync(".env.local"))
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined)
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured");
const directUri = process.env.MONGODB_DIRECT_HOSTS
  ? (() => {
      const match = uri.match(/^mongodb\+srv:\/\/([^@]+)@/);
      if (!match) return uri;
      const replica = process.env.MONGODB_REPLICA_SET
        ? `&replicaSet=${encodeURIComponent(process.env.MONGODB_REPLICA_SET)}`
        : "";
      return `mongodb://${match[1]}@${process.env.MONGODB_DIRECT_HOSTS}/?authSource=admin&tls=true${replica}`;
    })()
  : uri;
const date = "2026-09-05";
const start = new Date(`${date}T00:00:00+03:30`);
const end = new Date(start.getTime() + 86_400_000);
const client = new MongoClient(directUri, {
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
});

async function main() {
  await client.connect();
  const db = client.db();
  const candidateQuery = {
    provider: "football-api",
    leagueCode: "IR_SC",
    "rawApiResponse.league.id": 292,
    kickoffAt: { $gte: start, $lt: end },
  };
  const candidates = await db
    .collection<any>("matches")
    .find(candidateQuery, { projection: { _id: 1, providerMatchId: 1 } })
    .toArray();
  const ids = candidates.map((match) => String(match.providerMatchId));
  const predictionsBeforeDelete = ids.length
    ? await db
        .collection<any>("predictions")
        .find(
          { matchId: { $in: ids } },
          {
            projection: {
              _id: 1,
              userId: 1,
              matchId: 1,
              homeGoals: 1,
              awayGoals: 1,
            },
          },
        )
        .toArray()
    : [];
  const scoresBeforeDelete = ids.length
    ? await db
        .collection<any>("predictionScores")
        .countDocuments({ matchId: { $in: ids } })
    : 0;
  const deletedPredictions = ids.length
    ? await db.collection("predictions").deleteMany({ matchId: { $in: ids } })
    : { deletedCount: 0 };
  const deletedScores = ids.length
    ? await db
        .collection("predictionScores")
        .deleteMany({ matchId: { $in: ids } })
    : { deletedCount: 0 };
  const deletedMatches = candidates.length
    ? await db
        .collection("matches")
        .deleteMany({ _id: { $in: candidates.map((match) => match._id) } })
    : { deletedCount: 0 };
  const remainingMatches = ids.length
    ? await db
        .collection("matches")
        .countDocuments({ providerMatchId: { $in: ids } })
    : 0;
  const remainingPredictions = ids.length
    ? await db
        .collection("predictions")
        .countDocuments({ matchId: { $in: ids } })
    : 0;
  console.log(
    JSON.stringify(
      {
        date,
        candidateIds: ids,
        predictionsBeforeDelete,
        scoresBeforeDelete,
        deleted: {
          matches: deletedMatches.deletedCount,
          predictions: deletedPredictions.deletedCount,
          predictionScores: deletedScores.deletedCount,
        },
        remaining: {
          matches: remainingMatches,
          predictions: remainingPredictions,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
