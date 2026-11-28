import { isSeniorFriendlyAllowedForMatch } from "@/lib/football/internationalWindows";
/**
 * LowBlock currently supports men's football competitions only.
 *
 * The provider sometimes returns women's national fixtures with ordinary
 * country names and a "World" category. Country names / "national: true"
 * do not indicate gender. Use the provider's explicit team/event gender
 * and tournament identity before resolving competition or saving teams.
 */
const WOMENS_LABEL =
  /\b(?:women(?:['’]s)?|womens|woman|female|feminine|femenin[oa]s?|feminino|femenina|feminino|femminile|femmes|frauen|damen|ladies|girls)\b/i;

function femaleGender(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^(?:f|female|woman|women|w)$/i.test(value.trim());
}

function genderFields(value: any): unknown[] {
  return [value?.gender, value?.sex, value?.teamGender, value?.teamType, value?.genderName];
}

function identityFields(value: any): unknown[] {
  return [value?.name, value?.slug, value?.title, value?.shortName];
}

export function isWomensFootballFixture(input: any): boolean {
  if (!input || typeof input !== "object") return false;
  const event = input.rawApiResponse?.event ?? input.rawApiResponse ?? input.event ?? input;
  const tournament = event.tournament ?? input.tournament;
  const unique = tournament?.uniqueTournament ?? event.uniqueTournament ?? input.uniqueTournament;
  const categories = [
    event.category, tournament?.category, unique?.category,
    event.homeTeam?.category, event.awayTeam?.category,
  ];
  const objects = [event, tournament, unique, event.homeTeam, event.awayTeam, ...categories];
  if (objects.some((obj) => genderFields(obj).some(femaleGender))) return true;
  return [tournament, unique, event.homeTeam, event.awayTeam, ...categories]
    .flatMap(identityFields)
    .some((value) => typeof value === "string" && WOMENS_LABEL.test(value));
}

/**
 * Defense-in-depth when querying already-stored records, before cleanup
 * finishes or if a legacy importer bypasses the normalized import path.
 */
export function isSupportedMensFootballFixture(match: any): boolean {
  return Boolean(match) && !isWomensFootballFixture(match);
}

/** Apply the same import/calendar restrictions when scheduling or sending alerts. */
export function isNotifiableFootballFixture(match: any): boolean {
  if (!isSupportedMensFootballFixture(match) || !match.providerMatchId ||
      match.duplicateOf) return false;
  const kickoff = new Date(match.kickoffAt);
  return Number.isFinite(kickoff.getTime()) &&
    isSeniorFriendlyAllowedForMatch(String(match.leagueCode ?? ""), kickoff);
}

/**
 * Conservative DB-side filter for records imported by older versions.
 * This protects paginated lists before all legacy fixtures have been purged.
 */
export const WOMENS_FIXTURE_MONGO_EXCLUSIONS: Record<string, unknown>[] = [
  { "rawApiResponse.homeTeam.gender": { $in: ["F", "female", "Female", "women", "Women"] } },
  { "rawApiResponse.awayTeam.gender": { $in: ["F", "female", "Female", "women", "Women"] } },
  { "rawApiResponse.tournament.gender": { $in: ["F", "female", "Female", "women", "Women"] } },
  { "rawApiResponse.tournament.uniqueTournament.gender": { $in: ["F", "female", "Female", "women", "Women"] } },
  { "rawApiResponse.tournament.name": { $regex: "women|female|feminine|frauen|femminile", $options: "i" } },
  { "rawApiResponse.tournament.uniqueTournament.name": { $regex: "women|female|feminine|frauen|femminile", $options: "i" } },
  { "rawApiResponse.tournament.slug": { $regex: "women|female|feminine|frauen|femminile", $options: "i" } },
  { "rawApiResponse.tournament.uniqueTournament.slug": { $regex: "women|female|feminine|frauen|femminile", $options: "i" } },
];
