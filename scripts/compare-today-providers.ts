import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

if (existsSync(".env.local")) for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

function keyPart(value: unknown) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}
function fixtureKey(match: any) {
  return `${keyPart(match.homeTeam?.name)}:${keyPart(match.awayTeam?.name)}`;
}

async function main() {
  await client.connect();
  const db = client.db();
  const now = new Date();
  const iranDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = new Date(`${iranDate}T00:00:00+03:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = await db.collection<any>("matches").find({ provider: { $in: ["football-api", "sportsapi"] }, kickoffAt: { $gte: start, $lt: end } }, { projection: { provider: 1, providerMatchId: 1, kickoffAt: 1, status: 1, leagueCode: 1, homeTeam: 1, awayTeam: 1, homeGoals: 1, awayGoals: 1 } }).sort({ kickoffAt: 1 }).toArray();
  const sportsapiNearby = await db.collection<any>("matches").find({ provider: "sportsapi", kickoffAt: { $gte: new Date(start.getTime() - 6 * 60 * 60 * 1000), $lt: new Date(end.getTime() + 6 * 60 * 60 * 1000) } }, { projection: { providerMatchId: 1, kickoffAt: 1, status: 1, leagueCode: 1, homeTeam: 1, awayTeam: 1 } }).sort({ kickoffAt: 1 }).toArray();
  const grouped = new Map<string, any[]>();
  for (const row of rows) { const key = fixtureKey(row); const list = grouped.get(key) ?? []; list.push(row); grouped.set(key, list); }
  const output = { date: iranDate, window: { start, end }, totalRecords: rows.length, both: [] as any[], sportsapiOnly: [] as any[], footballApiOnly: [] as any[] };
  for (const list of grouped.values()) {
    const providers = new Set(list.map((row) => row.provider));
    const item = { home: list[0].homeTeam?.name, away: list[0].awayTeam?.name, kickoffAt: list[0].kickoffAt, leagueCodes: [...new Set(list.map((row) => row.leagueCode))], sources: list.map((row) => ({ provider: row.provider, id: row.providerMatchId, status: row.status, score: [row.homeGoals, row.awayGoals] })) };
    if (providers.has("football-api") && providers.has("sportsapi")) output.both.push(item);
    else if (providers.has("sportsapi")) output.sportsapiOnly.push(item);
    else output.footballApiOnly.push(item);
  }
  console.log(JSON.stringify({ ...output, sportsapiCountInWindow: rows.filter((row) => row.provider === "sportsapi").length, sportsapiNearby }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => client.close());
