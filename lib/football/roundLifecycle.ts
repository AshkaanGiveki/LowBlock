import type { Db } from "mongodb";
import type { RoundStatus } from "@/lib/domain/types";

export function deriveRoundStatus(fixtures: Array<{ status: string; kickoffAt: Date | string; homeGoals?: number | null; awayGoals?: number | null }>, now = new Date()): { status: RoundStatus; completedFixtures: number; eligibleFixtures: number } {
  const eligible = fixtures.filter(fixture => !["VOID", "CANCELLED"].includes(String(fixture.status)));
  const completed = eligible.filter(fixture => fixture.status === "FINISHED" && fixture.homeGoals != null && fixture.awayGoals != null).length;
  const status: RoundStatus = completed === eligible.length && eligible.length > 0 ? "FINAL" : eligible.some(fixture => fixture.status === "LIVE") ? "LIVE" : eligible.some(fixture => new Date(fixture.kickoffAt).getTime() <= now.getTime()) ? "PENDING" : "UPCOMING";
  return { status, completedFixtures: completed, eligibleFixtures: eligible.length };
}

export async function rebuildRoundRecords(db: Db) {
  const matches = await db.collection<any>("matches").find({ matchday: { $gt: 0 } }).toArray();
  const groups = new Map<string, any[]>();
  for (const match of matches) { const key = `${match.leagueCode}:${match.seasonStartYear}:${match.matchday}`; groups.set(key, [...(groups.get(key) ?? []), match]); }
  for (const [id, fixtures] of groups) { const first = fixtures[0]; const sorted = [...fixtures].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()); await db.collection("rounds").updateOne({ id }, { $set: { id, leagueCode: first.leagueCode, seasonId: String(first.seasonStartYear), leagueSeasonId: `${first.leagueCode}:${first.seasonStartYear}`, number: first.matchday, name: `Round ${first.matchday}`, scheduledStart: sorted[0]?.kickoffAt ?? null, scheduledEnd: sorted.at(-1)?.kickoffAt ?? null, ...deriveRoundStatus(fixtures), updatedAt: new Date() } }, { upsert: true }); await db.collection("matches").updateMany({ _id: { $in: fixtures.map(fixture => fixture._id) } }, { $set: { roundId: id } }); }
  return groups.size;
}

