import { closeMongo, getDb } from "../lib/db/mongo";
import { env } from "../lib/env";
import ratingsData from "../data/h2h-team-ratings-review.json";

const SOURCE = "data/h2h-team-ratings-review.json";
const VERSION = `review-${String(ratingsData.generatedAt).slice(0, 10)}`;

async function main() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const db = await getDb();
  const rows = ratingsData.teams.map((team) => ({
    centralTeamId: String(team.teamId),
    rating: Number(team.rating),
    name: String(team.name),
    isNational: Boolean(team.isNational),
  }));
  const invalid = rows.filter((row) => !row.centralTeamId || !Number.isInteger(row.rating) || row.rating < 1 || row.rating > 100);
  if (invalid.length) throw new Error(`Invalid reviewed H2H ratings: ${invalid.map((row) => row.name).join(", ")}`);
  const centralIds = rows.map((row) => row.centralTeamId);
  const teams = await db.collection<any>("centralTeams").find({ centralTeamId: { $in: centralIds } }, { projection: { _id: 1, centralTeamId: 1 } }).toArray();
  const existing = new Set(teams.map((team) => String(team.centralTeamId)));
  const missing = rows.filter((row) => !existing.has(row.centralTeamId));
  if (missing.length) throw new Error(`Missing canonical Central Teams for reviewed ratings: ${missing.map((row) => `${row.name} (${row.centralTeamId})`).join(", ")}`);
  const now = new Date();
  let updated = 0;
  for (const row of rows) {
    const result = await db.collection("centralTeams").updateOne(
      { centralTeamId: row.centralTeamId },
      { $set: { h2hRating: row.rating, h2hRatingVersion: VERSION, h2hRatingSource: SOURCE, h2hRatingApprovedAt: new Date(String(ratingsData.generatedAt)), h2hRatingUpdatedAt: now } },
    );
    updated += result.modifiedCount;
  }
  await db.collection("centralTeams").createIndex({ h2hRatingVersion: 1, centralTeamId: 1 }, { name: "central_team_h2h_rating_version" });
  const stillMissing = await db.collection("centralTeams").countDocuments({ centralTeamId: { $in: centralIds }, h2hRating: { $exists: false } });
  if (stillMissing) throw new Error(`${stillMissing} reviewed teams still have no h2hRating after sync`);
  console.log(JSON.stringify({ source: SOURCE, version: VERSION, reviewedTeams: rows.length, matchedCentralTeams: teams.length, updated, missing: 0 }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeMongo().catch(() => undefined));
