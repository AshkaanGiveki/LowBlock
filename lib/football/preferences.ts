import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { GLOBAL_LEAGUE_CODES, LEAGUES } from "@/lib/football/leagues";

const knownCodes = new Set<string>(LEAGUES.map((league) => league.code));

export type TournamentPreferences = {
  favoriteTournamentIds: string[];
  showAllMatches: boolean;
};

function cleanCodes(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((code): code is string => typeof code === "string" && knownCodes.has(code)))] : [];
}

export async function getTournamentPreferences(userId: string): Promise<TournamentPreferences> {
  if (!ObjectId.isValid(userId)) return { favoriteTournamentIds: [...GLOBAL_LEAGUE_CODES], showAllMatches: false };
  const user = await (await getDb()).collection<any>("users").findOne({ _id: new ObjectId(userId) }, { projection: { favoriteTournamentIds: 1, favoriteTournamentExclusions: 1, showAllMatches: 1 } });
  const additions = cleanCodes(user?.favoriteTournamentIds);
  const exclusions = new Set(cleanCodes(user?.favoriteTournamentExclusions));
  const favorites = [...new Set([...GLOBAL_LEAGUE_CODES.filter((code) => !exclusions.has(code)), ...additions])];
  return { favoriteTournamentIds: favorites, showAllMatches: user?.showAllMatches === true };
}

export async function updateTournamentPreference(userId: string, code: string, favorite: boolean) {
  if (!ObjectId.isValid(userId) || !knownCodes.has(code)) throw new Error("INVALID_TOURNAMENT");
  const db = await getDb();
  const now = new Date();
  if (favorite) {
    await db.collection<any>("users").updateOne({ _id: new ObjectId(userId) }, { $addToSet: { favoriteTournamentIds: code }, $pull: { favoriteTournamentExclusions: code }, $set: { updatedAt: now } } as any);
  } else if (new Set<string>(GLOBAL_LEAGUE_CODES).has(code)) {
    await db.collection<any>("users").updateOne({ _id: new ObjectId(userId) }, { $pull: { favoriteTournamentIds: code }, $addToSet: { favoriteTournamentExclusions: code }, $set: { updatedAt: now } } as any);
  } else {
    await db.collection<any>("users").updateOne({ _id: new ObjectId(userId) }, { $pull: { favoriteTournamentIds: code }, $set: { updatedAt: now } } as any);
  }
  return getTournamentPreferences(userId);
}

export async function setShowAllMatches(userId: string, showAllMatches: boolean) {
  if (!ObjectId.isValid(userId)) throw new Error("AUTH_REQUIRED");
  await (await getDb()).collection<any>("users").updateOne({ _id: new ObjectId(userId) }, { $set: { showAllMatches, updatedAt: new Date() } });
  return getTournamentPreferences(userId);
}
