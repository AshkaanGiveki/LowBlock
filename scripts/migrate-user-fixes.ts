import fs from "fs";
import { getDb } from "../lib/db/mongo";

async function main() {
  if (fs.existsSync(".env.local")) {
    const envContent = fs.readFileSync(".env.local", "utf8");
    for (const line of envContent.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }

  const db = await getDb();

  console.log("--- 1. Fixing USA vs Chile (16787722) ---");
  const usaChileMatchRes = await db.collection("matches").updateOne(
    { providerMatchId: "16787722" },
    {
      $set: {
        status: "FINISHED",
        homeGoals: 4,
        awayGoals: 2,
        elapsed: 90,
        updatedAt: new Date(),
      },
    },
  );
  console.log("Updated USA vs Chile in matches:", usaChileMatchRes.modifiedCount);

  const usaChileDetailsRes = await db.collection("matchDetails").updateOne(
    { matchId: "16787722" },
    {
      $set: {
        "score.status": "FINISHED",
        "score.home": 4,
        "score.away": 2,
        "score.elapsed": 90,
        "score.statusDescription": "Ended",
        updatedAt: new Date(),
      },
    },
  );
  console.log("Updated USA vs Chile in matchDetails:", usaChileDetailsRes.modifiedCount);

  console.log("\n--- 2. Fixing any past matches with anomalous elapsed > 130 or ended status ---");
  const pastMatches = await db
    .collection<any>("matches")
    .find({
      $or: [
        { elapsed: { $gt: 130 } },
        { status: "SCHEDULED", kickoffAt: { $lt: new Date(Date.now() - 3 * 3600 * 1000) } },
      ],
    })
    .toArray();

  for (const m of pastMatches) {
    if (m.providerMatchId === "16787722") continue;
    const hasGoals = m.homeGoals !== null && m.awayGoals !== null;
    const newStatus = hasGoals ? "FINISHED" : m.status;
    const newElapsed = hasGoals ? 90 : null;
    console.log(`Fixing match ${m.providerMatchId} (${m.homeTeam?.name} vs ${m.awayTeam?.name}): status=${newStatus}, elapsed=${newElapsed}`);
    await db.collection("matches").updateOne(
      { _id: m._id },
      { $set: { status: newStatus, elapsed: newElapsed, updatedAt: new Date() } },
    );
  }

  console.log("\n--- 3. Migrating flagcdn logos to /api/team-image/ ---");
  const flagMatches = await db
    .collection<any>("matches")
    .find({
      $or: [
        { "homeTeam.logoUrl": { $regex: "flagcdn\\.com" } },
        { "awayTeam.logoUrl": { $regex: "flagcdn\\.com" } },
      ],
    })
    .toArray();

  console.log(`Found ${flagMatches.length} matches with flagcdn logos`);
  let updatedLogosCount = 0;
  for (const m of flagMatches) {
    const update: any = {};
    if (m.homeTeam?.logoUrl?.includes("flagcdn.com") && m.homeTeam?.id) {
      update["homeTeam.logoUrl"] = `/api/team-image/${m.homeTeam.id}`;
    }
    if (m.awayTeam?.logoUrl?.includes("flagcdn.com") && m.awayTeam?.id) {
      update["awayTeam.logoUrl"] = `/api/team-image/${m.awayTeam.id}`;
    }
    if (Object.keys(update).length > 0) {
      await db.collection("matches").updateOne({ _id: m._id }, { $set: update });
      updatedLogosCount++;
    }
  }
  console.log(`Updated ${updatedLogosCount} matches to use /api/team-image/`);

  // Run score engine if needed to recalculate scores for finished matches
  try {
    const { runScoreEngine } = await import("../lib/scoring/scoreEngine");
    const scoreResult = await runScoreEngine();
    console.log("Score engine run completed:", scoreResult);
  } catch (err) {
    console.error("Score engine error:", err);
  }

  console.log("\nMigration completed successfully.");
  process.exit(0);
}

main().catch(console.error);
