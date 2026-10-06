import { LEAGUES, type LeagueCode } from "./leagues";

export type CompetitionMappingEntry = {
  code: LeagueCode;
  apiSportsId: number;
  sportsApiUniqueTournamentId: number;
  expectedCategories?: string[];
  sportsApiTournamentIds?: number[];
  slugs: string[];
  aliases: string[];
};

export const COMPETITION_MAPPINGS: readonly CompetitionMappingEntry[] = [
  {
    code: "GB1",
    apiSportsId: 39,
    sportsApiUniqueTournamentId: 17,
    expectedCategories: ["England", "england", "UK", "United Kingdom"],
    slugs: ["premier-league"],
    aliases: ["Premier League", "English Premier League", "EPL"],
  },
  {
    code: "ES1",
    apiSportsId: 140,
    sportsApiUniqueTournamentId: 8,
    expectedCategories: ["Spain", "spain"],
    slugs: ["laliga", "la-liga"],
    aliases: ["LaLiga", "La Liga"],
  },
  {
    code: "L1",
    apiSportsId: 78,
    sportsApiUniqueTournamentId: 35,
    expectedCategories: ["Germany", "germany"],
    slugs: ["bundesliga"],
    aliases: ["Bundesliga", "German Bundesliga"],
  },
  {
    code: "IT1",
    apiSportsId: 135,
    sportsApiUniqueTournamentId: 23,
    expectedCategories: ["Italy", "italy"],
    slugs: ["serie-a"],
    aliases: ["Serie A", "Italian Serie A"],
  },
  {
    code: "FR1",
    apiSportsId: 61,
    sportsApiUniqueTournamentId: 34,
    expectedCategories: ["France", "france"],
    slugs: ["ligue-1"],
    aliases: ["Ligue 1", "French Ligue 1"],
  },
  {
    code: "UCL",
    apiSportsId: 2,
    sportsApiUniqueTournamentId: 7,
    expectedCategories: ["Europe", "europe"],
    slugs: ["uefa-champions-league", "champions-league"],
    aliases: ["UEFA Champions League", "Champions League", "UCL"],
  },
  {
    code: "WC",
    apiSportsId: 1,
    sportsApiUniqueTournamentId: 16,
    expectedCategories: ["World", "world"],
    slugs: ["world-cup", "fifa-world-cup"],
    aliases: ["FIFA World Cup", "World Cup"],
  },
  {
    code: "EURO",
    apiSportsId: 4,
    sportsApiUniqueTournamentId: 1,
    expectedCategories: ["Europe", "europe"],
    slugs: ["uefa-euro", "euro", "european-championship"],
    aliases: ["UEFA Euro", "Euro", "European Championship"],
  },
  {
    code: "COPA",
    apiSportsId: 9,
    sportsApiUniqueTournamentId: 134,
    expectedCategories: ["South America", "south-america", "CONMEBOL", "World", "world"],
    slugs: ["copa-america"],
    aliases: ["Copa América", "Copa America"],
  },
  {
    code: "WCQ_EU",
    apiSportsId: 32,
    sportsApiUniqueTournamentId: 2056,
    expectedCategories: ["Europe", "europe", "World", "world"],
    slugs: ["world-cup-qualification-uefa", "world-cup-qualification-europe"],
    aliases: ["World Cup Qualifiers Europe", "WC Qualification UEFA"],
  },
  {
    code: "WCQ_ASIA",
    apiSportsId: 30,
    sportsApiUniqueTournamentId: 2058,
    expectedCategories: ["Asia", "asia", "World", "world"],
    slugs: ["world-cup-qualification-afc", "world-cup-qualification-asia"],
    aliases: ["World Cup Qualifiers Asia", "WC Qualification AFC"],
  },
  {
    code: "WCQ_AFRICA",
    apiSportsId: 29,
    sportsApiUniqueTournamentId: 2057,
    expectedCategories: ["Africa", "africa", "World", "world"],
    slugs: ["world-cup-qualification-caf", "world-cup-qualification-africa"],
    aliases: ["World Cup Qualifiers Africa", "WC Qualification CAF"],
  },
  {
    code: "WCQ_SAM",
    apiSportsId: 34,
    sportsApiUniqueTournamentId: 2059,
    expectedCategories: ["South America", "south-america", "CONMEBOL", "World", "world"],
    slugs: ["world-cup-qualification-conmebol", "world-cup-qualification-south-america"],
    aliases: ["World Cup Qualifiers South America", "WC Qualification CONMEBOL"],
  },
  {
    code: "WCQ_CONCACAF",
    apiSportsId: 31,
    sportsApiUniqueTournamentId: 2060,
    expectedCategories: ["North & Central America", "north-central-america", "CONCACAF", "World", "world"],
    slugs: ["world-cup-qualification-concacaf"],
    aliases: ["World Cup Qualifiers CONCACAF", "WC Qualification CONCACAF"],
  },
  {
    code: "WCQ_OCEANIA",
    apiSportsId: 33,
    sportsApiUniqueTournamentId: 2061,
    expectedCategories: ["Oceania", "oceania", "OFC", "World", "world"],
    slugs: ["world-cup-qualification-ofc", "world-cup-qualification-oceania"],
    aliases: ["World Cup Qualifiers Oceania", "WC Qualification OFC"],
  },
  {
    code: "EUROQ",
    apiSportsId: 960,
    sportsApiUniqueTournamentId: 2055,
    expectedCategories: ["Europe", "europe"],
    slugs: ["uefa-euro-qualification", "european-championship-qualification"],
    aliases: ["UEFA Euro Qualifiers", "Euro Qualifiers"],
  },
  {
    code: "NATIONS",
    apiSportsId: 5,
    sportsApiUniqueTournamentId: 10783,
    expectedCategories: ["Europe", "europe", "World", "world", "International", "international"],
    slugs: ["uefa-nations-league"],
    aliases: ["UEFA Nations League", "Nations League"],
  },
  {
    code: "AFCON",
    apiSportsId: 6,
    sportsApiUniqueTournamentId: 270,
    expectedCategories: ["Africa", "africa", "CAF"],
    slugs: ["africa-cup-of-nations", "afcon"],
    aliases: ["Africa Cup of Nations", "AFCON"],
  },
  {
    code: "AFC_ASIAN_CUP",
    apiSportsId: 7,
    sportsApiUniqueTournamentId: 268,
    expectedCategories: ["Asia", "asia", "AFC"],
    slugs: ["afc-asian-cup", "asian-cup"],
    aliases: ["AFC Asian Cup", "Asian Cup"],
  },
  {
    code: "GOLD_CUP",
    apiSportsId: 22,
    sportsApiUniqueTournamentId: 2054,
    expectedCategories: ["North & Central America", "north-central-america", "CONCACAF"],
    slugs: ["concacaf-gold-cup", "gold-cup"],
    aliases: ["CONCACAF Gold Cup", "Gold Cup"],
  },
  {
    code: "UEL",
    apiSportsId: 3,
    sportsApiUniqueTournamentId: 679,
    expectedCategories: ["Europe", "europe"],
    slugs: ["uefa-europa-league", "europa-league"],
    aliases: ["UEFA Europa League", "Europa League", "UEL"],
  },
  {
    code: "ACLE",
    apiSportsId: 17,
    sportsApiUniqueTournamentId: 450,
    expectedCategories: ["Asia", "asia", "AFC"],
    slugs: ["afc-champions-league-elite", "afc-champions-league"],
    aliases: ["AFC Champions League Elite", "AFC Champions League", "ACLE"],
  },
  {
    code: "IR1",
    apiSportsId: 290,
    sportsApiUniqueTournamentId: 955,
    expectedCategories: ["Iran", "iran"],
    slugs: ["persian-gulf-pro-league", "pro-league"],
    aliases: ["Persian Gulf Pro League", "Iran Pro League"],
  },
  {
    code: "SA1",
    apiSportsId: 307,
    sportsApiUniqueTournamentId: 954,
    expectedCategories: ["Saudi Arabia", "saudi-arabia"],
    slugs: ["saudi-pro-league"],
    aliases: ["Saudi Pro League", "Saudi Professional League"],
  },
  {
    code: "FRIENDLY",
    apiSportsId: 10,
    sportsApiUniqueTournamentId: 851,
    expectedCategories: ["World", "world", "International", "international"],
    slugs: ["international-friendly-games", "int-friendly-games", "friendlies"],
    aliases: ["International Friendlies", "Friendly Games", "International Friendly Games"],
  },
  {
    code: "UECL",
    apiSportsId: 848,
    sportsApiUniqueTournamentId: 17015,
    expectedCategories: ["Europe", "europe"],
    slugs: ["uefa-conference-league", "conference-league"],
    aliases: ["UEFA Conference League", "Conference League", "UECL"],
  },
  {
    code: "UEFA_SC",
    apiSportsId: 531,
    sportsApiUniqueTournamentId: 1314,
    expectedCategories: ["Europe", "europe"],
    slugs: ["uefa-super-cup"],
    aliases: ["UEFA Super Cup", "Super Cup"],
  },
  {
    code: "GB2",
    apiSportsId: 40,
    sportsApiUniqueTournamentId: 18,
    expectedCategories: ["England", "england", "UK"],
    slugs: ["championship", "efl-championship"],
    aliases: ["Championship", "EFL Championship"],
  },
  {
    code: "GB_FA",
    apiSportsId: 45,
    sportsApiUniqueTournamentId: 19,
    expectedCategories: ["England", "england", "UK"],
    slugs: ["fa-cup"],
    aliases: ["FA Cup", "The FA Cup"],
  },
  {
    code: "GB_CARABAO",
    apiSportsId: 48,
    sportsApiUniqueTournamentId: 20,
    expectedCategories: ["England", "england", "UK"],
    slugs: ["efl-cup", "carabao-cup", "league-cup"],
    aliases: ["Carabao Cup", "EFL Cup", "League Cup"],
  },
  {
    code: "GB_CS",
    apiSportsId: 528,
    sportsApiUniqueTournamentId: 1317,
    expectedCategories: ["England", "england", "UK"],
    slugs: ["community-shield", "fa-community-shield"],
    aliases: ["Community Shield", "FA Community Shield"],
  },
  {
    code: "ES_COPA",
    apiSportsId: 143,
    sportsApiUniqueTournamentId: 329,
    expectedCategories: ["Spain", "spain"],
    slugs: ["copa-del-rey"],
    aliases: ["Copa del Rey"],
  },
  {
    code: "ES_SC",
    apiSportsId: 556,
    sportsApiUniqueTournamentId: 1315,
    expectedCategories: ["Spain", "spain"],
    slugs: ["spanish-super-cup", "supercopa-de-espana"],
    aliases: ["Spanish Super Cup", "Supercopa de España"],
  },
  {
    code: "DE_CUP",
    apiSportsId: 81,
    sportsApiUniqueTournamentId: 211,
    expectedCategories: ["Germany", "germany"],
    slugs: ["dfb-pokal"],
    aliases: ["DFB Pokal", "DFB-Pokal"],
  },
  {
    code: "DE_SC",
    apiSportsId: 529,
    sportsApiUniqueTournamentId: 1316,
    expectedCategories: ["Germany", "germany"],
    slugs: ["german-super-cup", "dfl-supercup"],
    aliases: ["German Super Cup", "DFL Supercup", "DFL-Supercup"],
  },
  {
    code: "IT_CUP",
    apiSportsId: 137,
    sportsApiUniqueTournamentId: 327,
    expectedCategories: ["Italy", "italy"],
    slugs: ["coppa-italia"],
    aliases: ["Coppa Italia"],
  },
  {
    code: "IT_SC",
    apiSportsId: 547,
    sportsApiUniqueTournamentId: 1318,
    expectedCategories: ["Italy", "italy"],
    slugs: ["italian-super-cup", "supercoppa-italiana"],
    aliases: ["Italian Super Cup", "Supercoppa Italiana"],
  },
  {
    code: "FR_CUP",
    apiSportsId: 66,
    sportsApiUniqueTournamentId: 328,
    expectedCategories: ["France", "france"],
    slugs: ["coupe-de-france"],
    aliases: ["Coupe de France"],
  },
  {
    code: "FR_SC",
    apiSportsId: 526,
    sportsApiUniqueTournamentId: 1319,
    expectedCategories: ["France", "france"],
    slugs: ["trophee-des-champions", "french-super-cup"],
    aliases: ["Trophée des Champions", "French Super Cup"],
  },
  {
    code: "TR1",
    apiSportsId: 203,
    sportsApiUniqueTournamentId: 52,
    expectedCategories: ["Turkey", "turkey", "Türkiye", "turkiye"],
    slugs: ["super-lig"],
    aliases: ["Süper Lig", "Super Lig"],
  },
  {
    code: "TR_CUP",
    apiSportsId: 206,
    sportsApiUniqueTournamentId: 330,
    expectedCategories: ["Turkey", "turkey", "Türkiye", "turkiye"],
    slugs: ["turkish-cup", "turkiye-kupasi"],
    aliases: ["Turkish Cup", "Türkiye Kupası", "Turkiye Kupasi"],
  },
  {
    code: "TR_SC",
    apiSportsId: 551,
    sportsApiUniqueTournamentId: 1320,
    expectedCategories: ["Turkey", "turkey", "Türkiye", "turkiye"],
    slugs: ["turkish-super-cup", "super-kupa"],
    aliases: ["Turkish Super Cup", "Süper Kupa"],
  },
  {
    code: "IR_CUP",
    apiSportsId: 9487,
    sportsApiUniqueTournamentId: 2552,
    expectedCategories: ["Iran", "iran"],
    slugs: ["hazfi-cup"],
    aliases: ["Hazfi Cup"],
  },
  {
    code: "IR_SC",
    apiSportsId: 905,
    sportsApiUniqueTournamentId: 1321,
    expectedCategories: ["Iran", "iran"],
    slugs: ["iranian-super-cup"],
    aliases: ["Iranian Super Cup"],
  },
  {
    code: "SA_CUP",
    apiSportsId: 504,
    sportsApiUniqueTournamentId: 2553,
    expectedCategories: ["Saudi Arabia", "saudi-arabia"],
    slugs: ["kings-cup", "saudi-kings-cup"],
    aliases: ["King's Cup", "Kings Cup"],
  },
  {
    code: "SA_SC",
    apiSportsId: 826,
    sportsApiUniqueTournamentId: 1322,
    expectedCategories: ["Saudi Arabia", "saudi-arabia"],
    slugs: ["saudi-super-cup"],
    aliases: ["Saudi Super Cup"],
  },
];

const byCode = new Map<string, CompetitionMappingEntry>();
const byUniqueTournamentId = new Map<number, CompetitionMappingEntry>();
const byApiSportsId = new Map<number, CompetitionMappingEntry>();
const bySlug = new Map<string, CompetitionMappingEntry>();
const byAlias = new Map<string, CompetitionMappingEntry>();

for (const entry of COMPETITION_MAPPINGS) {
  byCode.set(entry.code, entry);
  byUniqueTournamentId.set(entry.sportsApiUniqueTournamentId, entry);
  byApiSportsId.set(entry.apiSportsId, entry);
  for (const slug of entry.slugs) {
    bySlug.set(slug.toLowerCase(), entry);
  }
  for (const alias of entry.aliases) {
    byAlias.set(alias.toLowerCase(), entry);
  }
}

function cleanString(str?: string | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function checkCategoryMatch(entry: CompetitionMappingEntry, tournament: any): boolean {
  if (!entry.expectedCategories || entry.expectedCategories.length === 0) return true;
  const catName = tournament?.category?.name || tournament?.uniqueTournament?.category?.name || "";
  const catSlug = tournament?.category?.slug || tournament?.uniqueTournament?.category?.slug || "";
  const countryName = tournament?.category?.country?.name || tournament?.uniqueTournament?.category?.country?.name || "";

  const values = [catName, catSlug, countryName].map(cleanString).filter(Boolean);
  if (!values.length) return true;

  return entry.expectedCategories.some((expected) => {
    const cleanExpected = cleanString(expected);
    if (!cleanExpected) return false;
    // For short codes (<= 3 chars, e.g. "uk"), only allow exact match to prevent "ukraine" matching "uk"
    if (cleanExpected.length <= 3) {
      return values.some((v) => v === cleanExpected);
    }
    return values.some((v) => v === cleanExpected || v.includes(cleanExpected) || cleanExpected.includes(v));
  });
}

/**
 * Resolves a canonical application leagueCode ("GB1", "ES1", etc.) from a SportsAPI Pro tournament object.
 */
export function getLeagueCodeFromSportsApi(tournament?: {
  id?: number | string | null;
  slug?: string | null;
  name?: string | null;
  category?: {
    name?: string | null;
    slug?: string | null;
    country?: { name?: string | null; slug?: string | null } | null;
  } | null;
  uniqueTournament?: {
    id?: number | string | null;
    slug?: string | null;
    name?: string | null;
    category?: {
      name?: string | null;
      slug?: string | null;
      country?: { name?: string | null; slug?: string | null } | null;
    } | null;
  } | null;
} | null): LeagueCode | null {
  if (!tournament) return null;

  // 1. Primary: Match by uniqueTournament.id (with category verification)
  const utId = Number(tournament.uniqueTournament?.id);
  if (Number.isFinite(utId) && byUniqueTournamentId.has(utId)) {
    const candidate = byUniqueTournamentId.get(utId)!;
    if (checkCategoryMatch(candidate, tournament)) {
      return candidate.code;
    }
  }

  // 2. Fallback: Match by uniqueTournament.slug (must match category)
  const utSlug = tournament.uniqueTournament?.slug?.toLowerCase();
  if (utSlug && bySlug.has(utSlug)) {
    const candidate = bySlug.get(utSlug)!;
    if (checkCategoryMatch(candidate, tournament)) {
      return candidate.code;
    }
  }

  // 3. Fallback: Match by tournament.slug (must match category)
  const tSlug = tournament.slug?.toLowerCase();
  if (tSlug && bySlug.has(tSlug)) {
    const candidate = bySlug.get(tSlug)!;
    if (checkCategoryMatch(candidate, tournament)) {
      return candidate.code;
    }
  }

  // 4. Fallback: Match by uniqueTournament.name alias (must match category)
  const utName = tournament.uniqueTournament?.name?.toLowerCase();
  if (utName && byAlias.has(utName)) {
    const candidate = byAlias.get(utName)!;
    if (checkCategoryMatch(candidate, tournament)) {
      return candidate.code;
    }
  }

  // 5. Fallback: Match by tournament.name alias (must match category)
  const tName = tournament.name?.toLowerCase();
  if (tName && byAlias.has(tName)) {
    const candidate = byAlias.get(tName)!;
    if (checkCategoryMatch(candidate, tournament)) {
      return candidate.code;
    }
  }

  return null;
}

/**
 * Maps an internal leagueCode to SportsAPI Pro uniqueTournamentId.
 */
export function getSportsApiUniqueTournamentId(code: string): number | null {
  return byCode.get(code)?.sportsApiUniqueTournamentId ?? null;
}

/**
 * Maps an internal leagueCode to API-Sports apiLeagueId.
 */
export function getApiSportsId(code: string): number | null {
  return byCode.get(code)?.apiSportsId ?? null;
}

/**
 * Checks if a given tournament is supported by LowBlock.
 */
export function isSupportedSportsApiTournament(tournament?: Parameters<typeof getLeagueCodeFromSportsApi>[0]): boolean {
  return getLeagueCodeFromSportsApi(tournament) !== null;
}
