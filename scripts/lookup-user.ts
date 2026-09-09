import { existsSync, readFileSync } from "node:fs";
import { ObjectId, MongoClient } from "mongodb";

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
const client = new MongoClient(directUri, {
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
});
async function main() {
  await client.connect();
  const user = await client
    .db()
    .collection("users")
    .findOne(
      { _id: new ObjectId("6a8226077ee22d780851eca9") },
      {
        projection: {
          _id: 1,
          username: 1,
          normalizedUsername: 1,
          email: 1,
          displayName: 1,
          createdAt: 1,
        },
      },
    );
  console.log(JSON.stringify(user, null, 2));
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
