import { getDb } from "@/lib/db/mongo";
import { NAMES_FA, repairPersianText, teamName } from "./team-names";

export type CanonicalTeamRecord = {
  _id?: unknown;
  name: string;
  faName: string;
  logoUrl: string | null;
  slug: string;
  providerIds: {
    "football-api"?: string;
    "sportsapi"?: string;
    [key: string]: string | undefined;
  };
  isNational?: boolean;
  updatedAt: Date;
  createdAt?: Date;
};

export const cleanTeamSlug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|afc|cf|1899|football club|sc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

function resolvePersianName(name: string, provider: string, providerTeamId?: string | number) {
  const fromDictionary = teamName("fa", Number(providerTeamId), name, provider as "football-api" | "sportsapi");
  if (fromDictionary !== name) return fromDictionary;
  return repairPersianText(NAMES_FA[name.toLowerCase()] || NAMES_FA[cleanTeamSlug(name)] || name);
}

// In-memory cache for sub-millisecond lookups
const byProviderKey = new Map<string, CanonicalTeamRecord>();
const bySlug = new Map<string, CanonicalTeamRecord>();
let initialized = false;

/**
 * Initializes the in-memory canonical team registry from MongoDB.
 * Completely internal - ZERO external API calls.
 */
export async function initTeamRegistry() {
  if (initialized) return;
  try {
    const db = await getDb();
    const rows = await db.collection<any>("teams").find().toArray();

    for (const row of rows) {
      const name = row.name || row.sourceName || "Unknown";
      const slug = row.slug || cleanTeamSlug(name);
      const faName = resolvePersianName(name, row.provider || "football-api", row.providerTeamId);
      const logoUrl = row.logoUrl || row.crestUrl || null;

      const providerIds = row.providerIds || {};
      if (row.provider && row.providerTeamId) {
        providerIds[row.provider] = String(row.providerTeamId);
      }

      const team: CanonicalTeamRecord = {
        _id: row._id,
        name,
        faName,
        logoUrl,
        slug,
        providerIds,
        isNational: Boolean(row.isNational),
        updatedAt: row.updatedAt || new Date(),
      };

      bySlug.set(slug, team);
      for (const [prov, pId] of Object.entries(providerIds)) {
        if (pId) byProviderKey.set(`${prov}:${pId}`, team);
      }
    }
    initialized = true;
  } catch (err) {
    console.error("[TeamRegistry] Init failed:", err);
  }
}

/**
 * Synchronous resolver for team metadata (checks in-memory registry or static dictionary).
 * Completely internal - ZERO external API calls.
 */
export function getCanonicalTeamSync(params: {
  provider: "football-api" | "sportsapi";
  providerTeamId: string | number;
  name: string;
  country?: { name?: string; alpha2?: string } | null;
  isNational?: boolean;
}): {
  id: number;
  name: string;
  faName: string;
  logoUrl: string | null;
} {
  const providerKey = `${params.provider}:${params.providerTeamId}`;
  const slug = cleanTeamSlug(params.name);

  // 1. Direct hit by provider ID or slug in memory
  const team = byProviderKey.get(providerKey) || bySlug.get(slug);
  if (team) {
    return {
      id: Number(params.providerTeamId),
      name: team.name,
      faName: team.faName,
      logoUrl: team.logoUrl,
    };
  }

  // 2. Fallback to NAMES_FA static dictionary
  const faName = resolvePersianName(params.name, params.provider, params.providerTeamId);

  let logoUrl: string | null = null;
  const alpha2 = params.country?.alpha2?.toLowerCase();
  const isNational = Boolean(params.isNational);

  if (
    isNational ||
    params.name.toLowerCase().includes("england") ||
    params.name.toLowerCase().includes("scotland") ||
    params.name.toLowerCase().includes("wales")
  ) {
    if (params.name.toLowerCase().includes("england")) logoUrl = "https://flagcdn.com/w160/gb-eng.png";
    else if (params.name.toLowerCase().includes("scotland")) logoUrl = "https://flagcdn.com/w160/gb-sct.png";
    else if (params.name.toLowerCase().includes("wales")) logoUrl = "https://flagcdn.com/w160/gb-wls.png";
    else if (alpha2) logoUrl = `https://flagcdn.com/w160/${alpha2}.png`;
  }

  return {
    id: Number(params.providerTeamId),
    name: params.name,
    faName,
    logoUrl,
  };
}

/**
 * Resolves a team to our central canonical team database.
 * If the team is not linked to this provider, it links it automatically by name/slug.
 * NEVER makes external REST API calls. Zero quota used.
 */
export async function resolveCanonicalTeam(params: {
  provider: "football-api" | "sportsapi";
  providerTeamId: string | number;
  name: string;
  country?: { name?: string; alpha2?: string } | null;
  isNational?: boolean;
}): Promise<{
  id: number;
  name: string;
  faName: string;
  logoUrl: string | null;
}> {
  await initTeamRegistry();

  const providerKey = `${params.provider}:${params.providerTeamId}`;
  const slug = cleanTeamSlug(params.name);

  // 1. Direct hit by provider ID
  let team = byProviderKey.get(providerKey);

  // 2. Fallback hit by clean slug
  if (!team && slug) {
    team = bySlug.get(slug);

    // If matched by slug, link this provider's ID for future instant hits!
    if (team) {
      team.providerIds[params.provider] = String(params.providerTeamId);
      byProviderKey.set(providerKey, team);

      // Asynchronously update MongoDB without blocking
      getDb().then((db) => {
        db.collection<any>("teams").updateOne(
          { _id: team!._id },
          {
            $set: {
              [`providerIds.${params.provider}`]: String(params.providerTeamId),
              updatedAt: new Date(),
            },
          },
        ).catch(() => undefined);
      });
    }
  }

  // 3. If found, return canonical data
  if (team) {
    return {
      id: Number(params.providerTeamId),
      name: team.name,
      faName: team.faName,
      logoUrl: team.logoUrl,
    };
  }

  // 4. If not found in central registry, determine Persian name and logo locally
  const faName = resolvePersianName(params.name, params.provider, params.providerTeamId);

  let logoUrl: string | null = null;
  const alpha2 = params.country?.alpha2?.toLowerCase();
  const isNational = Boolean(params.isNational);

  if (
    isNational ||
    params.name.toLowerCase().includes("england") ||
    params.name.toLowerCase().includes("scotland") ||
    params.name.toLowerCase().includes("wales")
  ) {
    if (params.name.toLowerCase().includes("england")) logoUrl = "https://flagcdn.com/w160/gb-eng.png";
    else if (params.name.toLowerCase().includes("scotland")) logoUrl = "https://flagcdn.com/w160/gb-sct.png";
    else if (params.name.toLowerCase().includes("wales")) logoUrl = "https://flagcdn.com/w160/gb-wls.png";
    else if (alpha2) logoUrl = `https://flagcdn.com/w160/${alpha2}.png`;
  }

  // Create new canonical team in registry
  const newTeam: CanonicalTeamRecord = {
    name: params.name,
    faName,
    logoUrl,
    slug,
    providerIds: { [params.provider]: String(params.providerTeamId) },
    isNational,
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  bySlug.set(slug, newTeam);
  byProviderKey.set(providerKey, newTeam);

  // Persist to MongoDB teams collection in background
  getDb().then((db) => {
    db.collection<any>("teams").insertOne({
      ...newTeam,
      sourceName: newTeam.name,
      crestUrl: newTeam.logoUrl,
      provider: params.provider,
      providerTeamId: String(params.providerTeamId),
    }).then((res: any) => {
      newTeam._id = res.insertedId;
    }).catch(() => undefined);
  });

  return {
    id: Number(params.providerTeamId),
    name: params.name,
    faName,
    logoUrl,
  };
}

/**
 * Syncs and enriches all existing 690 teams in MongoDB `teams` collection:
 * - Generates clean unique slugs
 * - Assigns Persian names from NAMES_FA
 * - Sets providerIds["football-api"]
 * - Zero external API calls!
 */
export async function migrateTeamsCollection() {
  const db = await getDb();
  const rows = await db.collection<any>("teams").find().toArray();
  console.log(`[TeamRegistry] Migrating ${rows.length} existing teams...`);

  let modified = 0;
  for (const row of rows) {
    const name = row.sourceName || row.name || "Unknown";
    const slug = cleanTeamSlug(name);
    const faName = resolvePersianName(name, row.provider || "football-api", row.providerTeamId);
    const logoUrl = row.crestUrl || row.logoUrl || null;
    const providerIds = row.providerIds || {};

    if (row.providerTeamId) {
      providerIds[row.provider || "football-api"] = String(row.providerTeamId);
    }

    await db.collection("teams").updateOne(
      { _id: row._id },
      {
        $set: {
          name,
          sourceName: name,
          faName,
          logoUrl,
          crestUrl: logoUrl,
          slug,
          providerIds,
          updatedAt: new Date(),
        },
      },
    );
    modified++;
  }
  console.log(`[TeamRegistry] Migration complete: ${modified} teams updated.`);
}
