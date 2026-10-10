import { getDb, closeMongo } from "../lib/db/mongo";
import { repairPersianText, teamName } from "../lib/football/team-names";

type TeamRow = {
  _id: unknown;
  provider?: string;
  providerTeamId?: string | number;
  providerIds?: Record<string, string>;
  sourceName?: string;
  name?: string;
  faName?: string;
};

function canonicalPersianName(row: TeamRow) {
  const sourceName = String(row.sourceName || row.name || "Unknown");
  const provider = row.provider === "sportsapi" ? "sportsapi" : "football-api";
  const providerId = row.providerTeamId ?? row.providerIds?.[provider] ?? 0;
  const dictionaryName = teamName("fa", Number(providerId), sourceName, provider);
  if (dictionaryName !== sourceName) return dictionaryName;

  // Preserve an existing manually curated value, but repair old mojibake.
  const existing = repairPersianText(String(row.faName || ""));
  return existing && existing !== sourceName ? existing : sourceName;
}

async function main() {
  const db = await getDb();
  const teams = await db.collection<TeamRow>("teams").find().toArray();
  let changedTeams = 0;

  for (const row of teams) {
    const sourceName = String(row.sourceName || row.name || "Unknown");
    const provider = row.provider || "football-api";
    const providerId = row.providerTeamId ?? row.providerIds?.[provider];
    const providerIds = { ...(row.providerIds || {}) };
    if (providerId !== undefined) providerIds[provider] = String(providerId);
    const faName = canonicalPersianName(row);
    const slug = sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^(fc|afc|cf)/, "");

    await db.collection("teams").updateOne(
      { _id: row._id },
      {
        $set: {
          name: sourceName,
          sourceName,
          faName,
          slug,
          providerIds,
          updatedAt: new Date(),
        },
      },
    );
    changedTeams++;
  }

  // Keep embedded match snapshots consistent for exports, notifications, and
  // consumers that do not go through the React teamName() formatter.
  const matches = await db.collection<any>("matches").find({ rawApiResponse: { $exists: true } }).toArray();
  let changedMatches = 0;
  for (const match of matches) {
    const set: Record<string, unknown> = {};
    for (const side of ["homeTeam", "awayTeam"] as const) {
      const team = match[side];
      if (!team?.name) continue;
      const faName = teamName("fa", Number(team.id), team.name, match.provider === "sportsapi" ? "sportsapi" : "football-api");
      if (faName !== team.name || team.faName) set[`${side}.faName`] = faName;
    }
    if (Object.keys(set).length) {
      await db.collection("matches").updateOne({ _id: match._id }, { $set: set });
      changedMatches++;
    }
  }

  console.log(JSON.stringify({ teams: changedTeams, matches: changedMatches }));
  await closeMongo();
}

main().catch(async (error) => {
  console.error(error);
  await closeMongo();
  process.exitCode = 1;
});
