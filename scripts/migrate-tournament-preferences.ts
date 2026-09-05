import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

if (existsSync(".env.local")) for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}
const srv = process.env.MONGODB_URI?.match(/^mongodb\+srv:\/\/([^@]+)@/);
if (!srv || !process.env.MONGODB_DIRECT_HOSTS) throw new Error("MongoDB configuration is missing");
const uri = `mongodb://${srv[1]}@${process.env.MONGODB_DIRECT_HOSTS}/?authSource=admin&tls=true&replicaSet=${process.env.MONGODB_REPLICA_SET}`;

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const [favorites, exclusions, globe] = await Promise.all([
    db.collection("users").updateMany({ favoriteTournamentIds: { $exists: false } }, { $set: { favoriteTournamentIds: [] } }),
    db.collection("users").updateMany({ favoriteTournamentExclusions: { $exists: false } }, { $set: { favoriteTournamentExclusions: [] } }),
    db.collection("users").updateMany({ showAllMatches: { $exists: false } }, { $set: { showAllMatches: false } }),
  ]);
  console.log(JSON.stringify({ favoriteTournamentIds: favorites.modifiedCount, favoriteTournamentExclusions: exclusions.modifiedCount, showAllMatches: globe.modifiedCount }));
  await client.close();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
