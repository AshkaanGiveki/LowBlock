import { env } from "../lib/env";
import { closeMongo, getDb } from "../lib/db/mongo";

const codes = [
  "GB1", "ES1", "L1", "IT1", "FR1", "IR1", "SA1", "GB2", "TR1",
  "UCL", "UEL", "FRIENDLY", "NATIONS", "ACLE",
];

async function main() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const db = await getDb();
  const matches = await db.collection<any>("matches").find(
    { leagueCode: { $in: codes } },
    { projection: { leagueCode: 1, homeTeam: 1, awayTeam: 1, homeGoals: 1, awayGoals: 1, status: 1, score: 1, seasonStartYear: 1, kickoffAt: 1 } },
  ).toArray();
  const teamSample = await db.collection<any>("teams").find({}).limit(5).toArray();
  const centralSample = await db.collection<any>("centralTeams").find({}).limit(5).toArray();
  console.log(JSON.stringify({ count: matches.length, sample: matches.slice(0, 3), teamSample, centralSample }, null, 2));
  await closeMongo();
}

main().catch(async (error) => {
  console.error(error);
  await closeMongo();
  process.exit(1);
});
