import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/mongo";
import { repairPersianText, teamName } from "./team-names";
import { reviewedPersianTeamName } from "./persian-team-names";
import type { ProviderName } from "./types";

export type CentralTeamRecord = {
  centralTeamId: string;
  names: { en: string; fa: string };
  providerIds: Partial<Record<ProviderName | "transfermarkt", string>>;
  providerNames: Partial<Record<ProviderName | "transfermarkt", string>>;
  aliases: string[];
  logoUrl: string | null;
  isNational: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const normalize = (value: string) => value.toLowerCase().trim().replace(/\b(fc|afc|cf|sc|club)\b/g, "").replace(/[^a-z0-9]/g, "");

export function centralTeamId(team: { centralTeamId?: string; provider: ProviderName; providerTeamId: string | number }) {
  return team.centralTeamId || `${team.provider}:${team.providerTeamId}`;
}

function initialFaName(provider: ProviderName, id: string, name: string) {
  const reviewed = reviewedPersianTeamName(name);
  if (reviewed) return reviewed;
  const candidates = [name, name.replace(/^(ssc|fc|afc|cf)\s+/i, ""), name.replace(/\s+hotspur$/i, "")];
  for (const candidate of candidates) {
    const translated = repairPersianText(teamName("fa", Number(id), candidate, provider));
    if (translated !== candidate) return translated;
  }
  return name;
}

export async function ensureCentralTeam(input: {
  provider: ProviderName;
  providerTeamId: string | number;
  sourceName: string;
  logoUrl?: string | null;
  isNational?: boolean;
}) {
  const db = await getDb();
  const providerTeamId = String(input.providerTeamId);
  const byProvider = await db.collection<CentralTeamRecord>("centralTeams").findOne({
    [`providerIds.${input.provider}`]: providerTeamId,
  });
  const fa = initialFaName(input.provider, providerTeamId, input.sourceName);
  if (byProvider) {
    await db.collection("centralTeams").updateOne(
      { _id: (byProvider as any)._id },
      { $set: { [`providerNames.${input.provider}`]: input.sourceName, updatedAt: new Date(), ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}) }, $addToSet: { aliases: input.sourceName } },
    );
    return byProvider.centralTeamId;
  }

  const alias = await db.collection<CentralTeamRecord>("centralTeams").findOne({ aliases: input.sourceName });
  const existing = alias || await db.collection<CentralTeamRecord>("centralTeams").findOne({ "names.en": { $regex: `^${input.sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
  if (existing) {
    await db.collection("centralTeams").updateOne(
      { _id: (existing as any)._id },
      { $set: { [`providerIds.${input.provider}`]: providerTeamId, [`providerNames.${input.provider}`]: input.sourceName, updatedAt: new Date() }, $addToSet: { aliases: input.sourceName } },
    );
    return existing.centralTeamId;
  }

  const record: CentralTeamRecord = {
    centralTeamId: randomUUID(),
    names: { en: input.sourceName, fa },
    providerIds: { [input.provider]: providerTeamId },
    providerNames: { [input.provider]: input.sourceName },
    aliases: [input.sourceName],
    logoUrl: input.logoUrl || null,
    isNational: Boolean(input.isNational),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.collection("centralTeams").insertOne(record as any);
  return record.centralTeamId;
}

export async function ensureCentralTeamIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection("centralTeams").createIndex({ centralTeamId: 1 }, { unique: true }),
    db.collection("centralTeams").createIndex({ "providerIds.football-api": 1 }, { sparse: true, unique: true }),
    db.collection("centralTeams").createIndex({ "providerIds.sportsapi": 1 }, { sparse: true, unique: true }),
    db.collection("centralTeams").createIndex({ aliases: 1 }),
  ]);
}
