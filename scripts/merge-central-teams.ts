import { getDb, closeMongo } from "../lib/db/mongo";
import { repairPersianText, teamName } from "../lib/football/team-names";

function identityKey(value: string) {
  const key = value.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ssc|fc|afc|cf|sc|club|hotspur)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  return key === "spurs" ? "tottenham" : key;
}

function faFor(row: any) {
  const candidates = [row.names?.en, ...(row.aliases || [])].filter(Boolean);
  for (const candidate of candidates) {
    const provider = row.providerIds?.sportsapi ? "sportsapi" : "football-api";
    const id = String(row.providerIds?.[provider] || "0");
    const translated = repairPersianText(teamName("fa", Number(id), String(candidate), provider));
    if (translated !== candidate) return translated;
  }
  return row.names?.fa || row.names?.en;
}

async function main() {
  const db = await getDb();
  const collection = db.collection<any>("centralTeams");
  const rows = await collection.find().toArray();
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const names = [row.names?.en, ...(row.aliases || [])].filter(Boolean);
    const groupKey = identityKey(String(names[0] || row.centralTeamId));
    groups.set(groupKey, [...(groups.get(groupKey) || []), row]);
  }

  let merged = 0;
  let conflicts = 0;
  const winnerById = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const providerIds = new Map<string, string>();
    let conflict = false;
    for (const row of group) {
      for (const [provider, id] of Object.entries(row.providerIds || {})) {
        const existing = providerIds.get(provider);
        if (existing && existing !== String(id)) conflict = true;
        providerIds.set(provider, String(id));
      }
    }
    if (conflict) { conflicts++; continue; }

    const winner = [...group].sort((a, b) => String(a.centralTeamId).localeCompare(String(b.centralTeamId)))[0];
    const aliases = [...new Set(group.flatMap((row) => [row.names?.en, ...(row.aliases || [])].filter(Boolean)))];
    const providerNames = Object.assign({}, ...group.map((row) => row.providerNames || {}));
    const mergedRow = {
      ...winner,
      providerIds: Object.fromEntries(providerIds),
      providerNames,
      aliases,
      names: { en: winner.names?.en || aliases[0], fa: faFor({ ...winner, providerIds: Object.fromEntries(providerIds), aliases }) },
      updatedAt: new Date(),
    };
    await collection.replaceOne({ _id: winner._id }, mergedRow);
    for (const duplicate of group.filter((row) => row._id.toString() !== winner._id.toString())) {
      winnerById.set(duplicate.centralTeamId, winner.centralTeamId);
      await db.collection("matches").updateMany(
        { "homeTeam.centralTeamId": duplicate.centralTeamId },
        { $set: { "homeTeam.centralTeamId": winner.centralTeamId } },
      );
      await db.collection("matches").updateMany(
        { "awayTeam.centralTeamId": duplicate.centralTeamId },
        { $set: { "awayTeam.centralTeamId": winner.centralTeamId } },
      );
      await collection.deleteOne({ _id: duplicate._id });
      merged++;
    }
  }

  // Restore side-specific IDs/names after the reference rewrite above.
  const canonical = await collection.find().toArray();
  const byId = new Map(canonical.map((row) => [row.centralTeamId, row]));
  const matches = await db.collection<any>("matches").find({ rawApiResponse: { $exists: true } }).toArray();
  const matchOps: any[] = [];
  for (const match of matches) {
    const set: Record<string, unknown> = {};
    for (const side of ["home", "away"] as const) {
      const id = match[`${side}Team`]?.centralTeamId;
      const row = byId.get(id);
      if (row) set[`${side}Team.faName`] = row.names.fa;
    }
    if (Object.keys(set).length) matchOps.push({ updateOne: { filter: { _id: match._id }, update: { $set: set } } });
  }
  if (matchOps.length) await db.collection("matches").bulkWrite(matchOps, { ordered: false });
  console.log(JSON.stringify({ centralTeamsBefore: rows.length, centralTeamsAfter: canonical.length, merged, conflicts, updatedMatches: matchOps.length }));
  await closeMongo();
}

main().catch(async (error) => { console.error(error); await closeMongo(); process.exitCode = 1; });
