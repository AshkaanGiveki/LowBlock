import { randomUUID } from "node:crypto";
import { getDb, closeMongo } from "../lib/db/mongo";
import { repairPersianText, teamName } from "../lib/football/team-names";
import type { ProviderName } from "../lib/football/types";

type Identity = { provider: ProviderName; id: string; name: string; logoUrl?: string | null };
const key = (provider: string, id: string) => `${provider}:${id}`;
const nameKey = (name: string) => name.toLowerCase().trim().replace(/\b(fc|afc|cf|sc|club)\b/g, "").replace(/[^a-z0-9]/g, "");
function faName(identity: Identity) {
  const candidates = [identity.name, identity.name.replace(/^(ssc|fc|afc|cf)\s+/i, ""), identity.name.replace(/\s+hotspur$/i, "")];
  for (const candidate of candidates) {
    const translated = repairPersianText(teamName("fa", Number(identity.id), candidate, identity.provider));
    if (translated !== candidate) return translated;
  }
  return identity.name;
}

function rawTeam(match: any, side: "home" | "away") {
  const raw = match.rawApiResponse;
  if (match.provider === "sportsapi") {
    const event = raw?.event || raw;
    return event?.[`${side}Team`];
  }
  return raw?.teams?.[side];
}

async function main() {
  const db = await getDb();
  const oldTeams = await db.collection<any>("teams").find().toArray();
  const matches = await db.collection<any>("matches").find({ rawApiResponse: { $exists: true } }).toArray();
  const identities = new Map<string, Identity>();

  for (const row of oldTeams) {
    const provider = row.provider === "sportsapi" ? "sportsapi" : "football-api" as ProviderName;
    const id = String(row.providerTeamId || row.providerIds?.[provider] || "");
    const name = String(row.sourceName || row.name || "");
    if (id && name) identities.set(key(provider, id), { provider, id, name, logoUrl: row.crestUrl || row.logoUrl });
  }
  for (const match of matches) {
    for (const side of ["home", "away"] as const) {
      const embedded = match[`${side}Team`];
      const raw = rawTeam(match, side);
      const id = String(raw?.id || raw?.eventId || embedded?.id || "");
      const name = String(raw?.name || embedded?.name || "");
      if (!id || !name) continue;
      identities.set(key(match.provider, id), { provider: match.provider, id, name, logoUrl: raw?.logo || embedded?.logoUrl || null });
    }
  }

  const existing = await db.collection<any>("centralTeams").find().toArray();
  const byProvider = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const row of existing) {
    for (const [provider, id] of Object.entries(row.providerIds || {})) byProvider.set(key(provider, String(id)), row);
    for (const name of [row.names?.en, ...(row.aliases || [])].filter(Boolean)) byName.set(nameKey(String(name)), row);
  }

  const writes: any[] = [];
  const matchWrites: any[] = [];
  for (const identity of identities.values()) {
    const providerKey = key(identity.provider, identity.id);
    let row = byProvider.get(providerKey) || byName.get(nameKey(identity.name));
    if (!row) {
      row = {
        centralTeamId: randomUUID(),
        names: { en: identity.name, fa: faName(identity) },
        providerIds: {}, providerNames: {}, aliases: [], logoUrl: identity.logoUrl || null,
        isNational: false, createdAt: new Date(), updatedAt: new Date(),
      };
      writes.push({ insertOne: { document: row } });
      byName.set(nameKey(identity.name), row);
    }
    row.providerIds[identity.provider] = identity.id;
    row.providerNames[identity.provider] = identity.name;
    const translated = faName(identity);
    if (translated !== identity.name) row.names.fa = translated;
    if (!row.aliases.includes(identity.name)) row.aliases.push(identity.name);
    row.updatedAt = new Date();
    byProvider.set(providerKey, row);
  }

  // Convert newly discovered rows to upserts so reruns are safe.
  const centralOps = [...writes, ...[...byProvider.values()].filter((row, index, all) => all.indexOf(row) === index && !writes.some((w) => w.insertOne?.document === row)).map((row) => ({ updateOne: { filter: { centralTeamId: row.centralTeamId }, update: { $set: { names: row.names, providerIds: row.providerIds, providerNames: row.providerNames, aliases: row.aliases, updatedAt: new Date() } }, upsert: true } }))];
  if (centralOps.length) await db.collection("centralTeams").bulkWrite(centralOps, { ordered: false });

  for (const match of matches) {
    const set: Record<string, unknown> = {};
    for (const side of ["home", "away"] as const) {
      const raw = rawTeam(match, side);
      const embedded = match[`${side}Team`];
      const id = String(raw?.id || raw?.eventId || embedded?.id || "");
      const canonical = byProvider.get(key(match.provider, id));
      if (!canonical) continue;
      set[`${side}Team.centralTeamId`] = canonical.centralTeamId;
      set[`${side}Team.faName`] = canonical.names.fa;
      if (raw?.name) set[`${side}Team.name`] = raw.name;
    }
    if (Object.keys(set).length) matchWrites.push({ updateOne: { filter: { _id: match._id }, update: { $set: set } } });
  }
  if (matchWrites.length) await db.collection("matches").bulkWrite(matchWrites, { ordered: false });
  console.log(JSON.stringify({ centralTeams: identities.size, migratedMatches: matchWrites.length }));
  await closeMongo();
}

main().catch(async (error) => { console.error(error); await closeMongo(); process.exitCode = 1; });
