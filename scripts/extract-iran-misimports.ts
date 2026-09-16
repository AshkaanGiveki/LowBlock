import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  const matches = await db
    .collection<any>("matches")
    .find({
      provider: "football-api",
      kickoffAt: { $gte: start, $lt: end },
      $or: [
        { leagueCode: { $in: ["IR_SC", "IR_CUP"] } },
        { "rawApiResponse.league.id": { $in: [291, 292] } },
      ],
    })
    .sort({ kickoffAt: 1, providerMatchId: 1 })
    .toArray();
  const ids = matches.map((match) => String(match.providerMatchId));
  const predictions = ids.length
    ? await db
        .collection<any>("predictions")
        .find(
          { matchId: { $in: ids } },
          {
            projection: {
              _id: 0,
              userId: 1,
              matchId: 1,
              homeGoals: 1,
              awayGoals: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ matchId: 1, userId: 1 })
        .toArray()
    : [];
  const predictionsByMatch = new Map<string, any[]>();
  for (const prediction of predictions)
    predictionsByMatch.set(String(prediction.matchId), [
      ...(predictionsByMatch.get(String(prediction.matchId)) ?? []),
      prediction,
    ]);
  const result = {
    date,
    warning: "Review only; no database records were changed.",
    matches: matches.map((match) => ({
      providerMatchId: match.providerMatchId,
      leagueCode: match.leagueCode,
      providerLeagueId: match.rawApiResponse?.league?.id ?? null,
      providerLeagueName: match.rawApiResponse?.league?.name ?? null,
      kickoffAt: new Date(match.kickoffAt).toISOString(),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      status: match.status,
      predictions: predictionsByMatch.get(String(match.providerMatchId)) ?? [],
    })),
  };
  mkdirSync("data", { recursive: true });
  writeFileSync(
    `data/iran-misimports-${date}.json`,
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        date,
        matches: result.matches.length,
        predictions: predictions.length,
        file: `data/iran-misimports-${date}.json`,
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
