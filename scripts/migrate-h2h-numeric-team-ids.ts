import { closeMongo, getDb } from "../lib/db/mongo";
import { env } from "../lib/env";

async function main() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const db = await getDb();
  const collection = db.collection<any>("centralTeams");
  const rows = await collection.find({}, { projection: { centralTeamId: 1, numericTeamId: 1 } }).sort({ centralTeamId: 1 }).toArray();
  const used = new Set<number>();
  let next = 1;
  for (const row of rows) if (Number.isInteger(row.numericTeamId) && row.numericTeamId > 0) { used.add(row.numericTeamId); next = Math.max(next, row.numericTeamId + 1); }
  let assigned = 0;
  for (const row of rows) {
    if (Number.isInteger(row.numericTeamId) && row.numericTeamId > 0) continue;
    while (used.has(next)) next++;
    await collection.updateOne({ _id: row._id, numericTeamId: { $exists: false } }, { $set: { numericTeamId: next, numericTeamIdAssignedAt: new Date() } });
    used.add(next++);
    assigned++;
  }
  await collection.createIndex({ numericTeamId: 1 }, { unique: true, name: "central_team_numeric_id" });
  await db.collection<any>("centralTeamCounters").updateOne({ _id: "numericTeamId" }, { $set: { nextValue: Math.max(...used, 0) } }, { upsert: true });
  console.log(JSON.stringify({ teams: rows.length, assigned, uniqueNumericIds: used.size }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeMongo().catch(() => undefined));
