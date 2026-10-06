import { createGzip } from "node:zlib";
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { MongoClient } from "mongodb";
import { EJSON } from "bson";

if (existsSync(".env.local")) for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = `backups/lowblock-mongodb-${stamp}.ejsonl.gz`;

function writeChunk(stream: NodeJS.WritableStream, chunk: string) {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => { reject(error); };
    stream.once("error", onError);
    stream.write(chunk, "utf8", (error?: Error | null) => {
      stream.off("error", onError);
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main() {
  mkdirSync("backups", { recursive: true });
  await client.connect();
  const db = client.db();
  const outputStream = createWriteStream(output);
  const gzip = createGzip({ level: 9 });
  gzip.pipe(outputStream);
  await writeChunk(gzip, `${EJSON.stringify({ format: "lowblock-mongodb-backup-v2", createdAt: new Date(), database: db.databaseName })}\n`);
  let collectionCount = 0;
  let documentCount = 0;
  for (const info of await db.listCollections({}, { nameOnly: true }).toArray()) {
    const collection = db.collection(info.name);
    await writeChunk(gzip, `${EJSON.stringify({ type: "collection", name: info.name, indexes: await collection.indexes() })}\n`);
    let count = 0;
    for await (const document of collection.find({})) {
      await writeChunk(gzip, `${EJSON.stringify({ type: "document", collection: info.name, document })}\n`);
      count++;
      documentCount++;
    }
    collectionCount++;
    console.log(`${info.name}: ${count} documents`);
  }
  await writeChunk(gzip, `${EJSON.stringify({ type: "footer", collectionCount, documentCount })}\n`);
  gzip.end();
  await new Promise<void>((resolve, reject) => { outputStream.once("finish", resolve); outputStream.once("error", reject); });
  console.log(JSON.stringify({ output, database: db.databaseName, collections: collectionCount, documents: documentCount, bytes: statSync(output).size }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => client.close());
