import fs from "fs";
import { getDb } from "../lib/db/mongo";
import { LEAGUES } from "../lib/football/leagues";

async function main() {
  const envContent = fs.readFileSync(".env.local", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }

  const db = await getDb();
  const matches = await db
    .collection("matches")
    .find({ provider: "sportsapi" })
    .sort({ kickoffAt: 1 })
    .toArray();

  console.log("Total matches with provider = sportsapi:", matches.length);

  const leagueNames = new Map(LEAGUES.map((l) => [l.code, `${l.enName} (${l.faName})`]));

  const byDate = new Map<string, number>();
  const byLeague = new Map<string, number>();
  const byStatus = new Map<string, number>();

  for (const m of matches) {
    const d = new Date(m.kickoffAt).toISOString().slice(0, 10);
    byDate.set(d, (byDate.get(d) || 0) + 1);
    byLeague.set(m.leagueCode, (byLeague.get(m.leagueCode) || 0) + 1);
    byStatus.set(m.status, (byStatus.get(m.status) || 0) + 1);
  }

  console.log("\n--- BY DATE ---");
  for (const [d, count] of byDate.entries()) {
    console.log(`${d}: ${count} matches`);
  }

  console.log("\n--- BY TOURNAMENT / LEAGUE ---");
  for (const [code, count] of byLeague.entries()) {
    console.log(`${code} [${leagueNames.get(code as any) || code}]: ${count} matches`);
  }

  console.log("\n--- BY STATUS ---");
  for (const [s, count] of byStatus.entries()) {
    console.log(`${s}: ${count} matches`);
  }

  console.log("\n--- ALL MATCHES LIST ---");
  for (const m of matches) {
    const dateStr = new Date(m.kickoffAt).toISOString().slice(0, 16).replace("T", " ");
    const scoreStr = m.status === "FINISHED" ? `[${m.homeGoals} - ${m.awayGoals}]` : "";
    console.log(
      `${dateStr} UTC | ${m.leagueCode.padEnd(8)} | ${m.homeTeam.name.padEnd(20)} vs ${m.awayTeam.name.padEnd(20)} | ${m.status.padEnd(10)} ${scoreStr}`
    );
  }

  process.exit(0);
}

main().catch(console.error);
