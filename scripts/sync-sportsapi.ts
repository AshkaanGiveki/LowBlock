import fs from "fs";
import { getDb } from "../lib/db/mongo";
import { SportsApiFootballProvider } from "../lib/football/sportsapi/provider";

async function main() {
  const envContent = fs.readFileSync(".env.local", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }

  process.env.FOOTBALL_DATA_PROVIDER = "sportsapi";

  console.log("Connecting to MongoDB...");
  const db = await getDb();
  console.log("Connected to MongoDB.");

  const provider = new SportsApiFootballProvider();
  console.log("Running SportsApiFootballProvider.sync()...");
  const result = await provider.sync();
  console.log("Sync result:", JSON.stringify(result, null, 2));

  const count = await db.collection("matches").countDocuments({ provider: "sportsapi" });
  console.log(`Matches in DB with provider: 'sportsapi': ${count}`);

  const todayStr = new Date().toISOString().slice(0, 10);
  const start = new Date(`${todayStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);

  const todayMatches = await db.collection("matches").find({
    provider: "sportsapi",
    kickoffAt: { $gte: start, $lt: end },
  }).toArray();

  console.log(`Today's matches in DB (UTC bounds): ${todayMatches.length}`);
  for (const m of todayMatches) {
    console.log(`- [${m.leagueCode}] ${m.homeTeam.name} vs ${m.awayTeam.name} (${new Date(m.kickoffAt).toISOString()}) status: ${m.status}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error running sync script:", err);
  process.exit(1);
});
