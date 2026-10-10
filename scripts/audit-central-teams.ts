import { getDb, closeMongo } from "../lib/db/mongo";

async function main() {
  const db = await getDb();
  const central = await db.collection<any>("centralTeams").find().toArray();
  const matches = await db.collection<any>("matches").find({ rawApiResponse: { $exists: true } }).toArray();
  const both = central.filter((x) => x.providerIds?.["football-api"] && x.providerIds?.sportsapi);
  const footballOnly = central.filter((x) => x.providerIds?.["football-api"] && !x.providerIds?.sportsapi);
  const sportsOnly = central.filter((x) => x.providerIds?.sportsapi && !x.providerIds?.["football-api"]);
  const neither = central.filter((x) => !x.providerIds?.["football-api"] && !x.providerIds?.sportsapi);
  const missing = matches.filter((m) => !m.homeTeam?.centralTeamId || !m.awayTeam?.centralTeamId);
  const byName = new Map<string, any[]>();
  for (const row of central) {
    const names = [row.names?.en, ...(row.aliases || [])].filter(Boolean).map((x) => String(x).toLowerCase().trim());
    for (const name of names) byName.set(name, [...(byName.get(name) || []), row]);
  }
  const ambiguousAliases = [...byName.entries()].filter(([, rows]) => new Set(rows.map((x) => x.centralTeamId)).size > 1);
  const sample = (rows: any[]) => rows.slice(0, 20).map((x) => ({
    centralTeamId: x.centralTeamId,
    names: x.names,
    providerIds: x.providerIds,
    providerNames: x.providerNames,
  }));
  const focus = central.filter((x) => /napoli|spurs|tottenham|gol gohar|manchester united/i.test(JSON.stringify(x)));
  console.log(JSON.stringify({
    centralTeams: central.length,
    distinctProviderIdentities: new Set(central.flatMap((x) => Object.entries(x.providerIds || {}).map(([p, id]) => `${p}:${id}`))).size,
    bothProviders: both.length,
    footballOnly: footballOnly.length,
    sportsOnly: sportsOnly.length,
    neither: neither.length,
    matches: matches.length,
    matchesMissingCentralTeamId: missing.length,
    ambiguousAliasCount: ambiguousAliases.length,
    samples: { both: sample(both), sportsOnly: sample(sportsOnly), focus: sample(focus), ambiguousAliases: ambiguousAliases.slice(0, 20).map(([alias, rows]) => ({ alias, centralTeamIds: rows.map((x) => x.centralTeamId), names: rows.map((x) => x.names) })) },
  }, null, 2));
  await closeMongo();
}

main().catch(async (error) => { console.error(error); await closeMongo(); process.exitCode = 1; });
