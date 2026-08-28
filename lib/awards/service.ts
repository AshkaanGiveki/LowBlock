import { randomInt } from "node:crypto";
import type { Db } from "mongodb";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { getRoundWinnerAsset, LOWBLOCK_SCOPE, ROUND_WINNER_TYPE } from "@/lib/awards/config";
export type AwardRecord = { _id?: unknown; userId: string; type: typeof ROUND_WINNER_TYPE; scope: typeof LOWBLOCK_SCOPE; competitionId: string; competitionName: string; seasonId: string; seasonStartYear: number; roundId: string; roundNumber: number; awardedAt: Date; revealedAt: Date | null; shareCopyIndex?: number };
export async function grantFinalRoundWinnerAwards(db: Db) {
  await db.collection("awards").createIndex({ userId: 1, type: 1, scope: 1, competitionId: 1, seasonId: 1, roundId: 1 }, { unique: true, name: "unique_lowblock_award" });
  await db.collection("awards").createIndex({ userId: 1, revealedAt: 1 });
  const rounds = await db.collection<any>("rounds").find({ status: "FINAL" }).toArray(); let granted = 0;
  for (const round of rounds) {
    const seasonStartYear = Number(round.seasonId); const asset = getRoundWinnerAsset(round.leagueCode, seasonStartYear, Number(round.number)); if (!asset) continue;
    const leaderboard = await getCanonicalLeaderboard(db, { leagueCode: round.leagueCode, seasonStartYear, matchday: Number(round.number) }, 1); const winner = leaderboard[0]; if (!winner) continue;
    const result = await db.collection<AwardRecord>("awards").updateOne({ userId: winner.userId, type: ROUND_WINNER_TYPE, scope: LOWBLOCK_SCOPE, competitionId: round.leagueCode, seasonId: String(round.seasonId), roundId: String(round.id) }, { $setOnInsert: { userId: winner.userId, type: ROUND_WINNER_TYPE, scope: LOWBLOCK_SCOPE, competitionId: round.leagueCode, competitionName: asset.leagueName, seasonId: String(round.seasonId), seasonStartYear, roundId: String(round.id), roundNumber: Number(round.number), awardedAt: new Date(), revealedAt: null, shareCopyIndex: randomInt(0, 40) } }, { upsert: true });
    if (result.upsertedCount) granted++;
  }
  return { rounds: rounds.length, granted };
}
