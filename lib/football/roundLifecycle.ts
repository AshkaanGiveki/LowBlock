import type { Db } from "mongodb";
import { getLeague } from "@/lib/football/leagues";
import type { RoundStatus } from "@/lib/domain/types";

// Number of fixture slots in one regular-season matchday. Keeping this explicit
// prevents a partial import (for example, one match fetched after the season
// started) from being mistaken for a complete round.
export function deriveRoundStatus(fixtures: Array<{ status: string; kickoffAt: Date | string; homeGoals?: number | null; awayGoals?: number | null }>, now = new Date(), expectedFixtures?: number | null): { status: RoundStatus; completedFixtures: number; eligibleFixtures: number; expectedFixtures: number | null } {
  const eligible = fixtures.filter(fixture => !["VOID", "CANCELLED"].includes(String(fixture.status)));
  const completed = eligible.filter(fixture => fixture.status === "FINISHED" && fixture.homeGoals != null && fixture.awayGoals != null).length;
  const observedComplete = completed === eligible.length && eligible.length > 0;
  const hasCompleteFixtureSet = expectedFixtures != null && fixtures.length >= expectedFixtures;
  const status: RoundStatus = observedComplete && (expectedFixtures === undefined ? true : expectedFixtures != null && hasCompleteFixtureSet) ? "FINAL" : eligible.some(fixture => fixture.status === "LIVE") ? "LIVE" : eligible.some(fixture => new Date(fixture.kickoffAt).getTime() <= now.getTime()) ? "PENDING" : "UPCOMING";
  return { status, completedFixtures: completed, eligibleFixtures: eligible.length, expectedFixtures: expectedFixtures ?? null };
}

export async function rebuildRoundRecords(db: Db) {
  const leagueSeasons = await db.collection<any>("leagueSeasons").find({}).toArray();
  const expectedBySeason = new Map(leagueSeasons.map((season) => [String(season.id), Number.isFinite(Number(season.expectedFixturesPerRound)) ? Number(season.expectedFixturesPerRound) : Number.isFinite(Number(season.teamCount)) && Number(season.teamCount) > 1 ? Number(season.teamCount) / 2 : null]));
  const matches = await db.collection<any>("matches").find({ matchday: { $gt: 0 } }).toArray();
  const groups = new Map<string, any[]>();
  for (const match of matches) { const key = `${match.leagueCode}:${match.seasonStartYear}:${match.matchday}`; groups.set(key, [...(groups.get(key) ?? []), match]); }
  for (const [id, fixtures] of groups) { const first = fixtures[0]; const sorted = [...fixtures].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()); const league = getLeague(first.leagueCode); const expectedFixtures = league?.kind === "LEAGUE" ? expectedBySeason.get(`${first.leagueCode}:${first.seasonStartYear}`) ?? null : null; await db.collection("rounds").updateOne({ id }, { $set: { id, leagueCode: first.leagueCode, seasonId: String(first.seasonStartYear), leagueSeasonId: `${first.leagueCode}:${first.seasonStartYear}`, number: first.matchday, name: `Round ${first.matchday}`, scheduledStart: sorted[0]?.kickoffAt ?? null, scheduledEnd: sorted.at(-1)?.kickoffAt ?? null, ...deriveRoundStatus(fixtures, new Date(), expectedFixtures), updatedAt: new Date() } }, { upsert: true }); await db.collection("matches").updateMany({ _id: { $in: fixtures.map(fixture => fixture._id) } }, { $set: { roundId: id } }); }
  return groups.size;
}

