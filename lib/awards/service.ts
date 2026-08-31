import { randomInt } from "node:crypto";
import type { Db } from "mongodb";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { getIranWeeklyPeriod } from "@/lib/domain/leaderboardPeriods";
import { getClubRoundAsset, getRoundWinnerAsset, LOWBLOCK_SCOPE, ROUND_WINNER_TYPE, CLUB_ROUND_WINNER_TYPE, WEEKLY_WINNER_TYPE, CLUB_WEEKLY_WINNER_TYPE, LEAGUE_WINNER_TYPE, GLOBAL_WINNER_TYPE, CLUB_LEAGUE_WINNER_TYPE, MONTHLY_EXACT_WINNER_TYPE, CLUB_MONTHLY_EXACT_WINNER_TYPE } from "@/lib/awards/config";

export type AwardRecord = { _id?: unknown; awardKey?: string; userId: string; type: string; scope: string; competitionId?: string; competitionName: string; seasonId?: string; seasonStartYear?: number; roundId?: string; roundNumber?: number; periodId?: string; clubId?: string; points?: number; exact?: number; predictions?: number; awardedAt: Date; revealedAt: Date | null; shareCopyIndex?: number };

async function ensureAwardIndexes(db: Db) {
  await db.collection("awards").createIndex({ awardKey: 1 }, { unique: true, sparse: true, name: "unique_award_key" });
  await db.collection("awards").createIndex({ userId: 1, revealedAt: 1 });
}

async function issue(db: Db, award: Omit<AwardRecord, "awardedAt" | "revealedAt" | "shareCopyIndex">, legacyFilter?: Record<string, unknown>) {
  if (legacyFilter) { const legacy = await db.collection<AwardRecord>("awards").findOne(legacyFilter); if (legacy) { if (legacy.awardKey !== award.awardKey) await db.collection("awards").updateOne({ _id: legacy._id }, { $set: { awardKey: award.awardKey } }); return 0; } }
  const result = await db.collection<AwardRecord>("awards").updateOne({ awardKey: award.awardKey }, { $setOnInsert: { ...award, awardedAt: new Date(), revealedAt: null, shareCopyIndex: randomInt(0, 40) } }, { upsert: true });
  return result.upsertedCount;
}

export async function grantFinalRoundWinnerAwards(db: Db) {
  const rounds = await db.collection<any>("rounds").find({ status: "FINAL" }).toArray(); let granted = 0;
  for (const round of rounds) {
    const seasonStartYear = Number(round.seasonId); const roundNumber = Number(round.number); const asset = getRoundWinnerAsset(round.leagueCode, seasonStartYear, roundNumber); const clubAsset = getClubRoundAsset(round.leagueCode, seasonStartYear, roundNumber); const competitionName = asset?.leagueName ?? clubAsset?.leagueName ?? round.leagueCode;
    const leaderboard = await getCanonicalLeaderboard(db, { leagueCode: round.leagueCode, seasonStartYear, matchday: roundNumber }, 1); const winner = leaderboard[0];
    if (winner) granted += await issue(db, { awardKey: `ROUND_WINNER:${LOWBLOCK_SCOPE}:${round.leagueCode}:${seasonStartYear}:${roundNumber}`, userId: winner.userId, type: ROUND_WINNER_TYPE, scope: LOWBLOCK_SCOPE, competitionId: round.leagueCode, competitionName, seasonId: String(round.seasonId), seasonStartYear, roundId: String(round.id), roundNumber }, { type: ROUND_WINNER_TYPE, scope: LOWBLOCK_SCOPE, competitionId: round.leagueCode, seasonId: String(round.seasonId), roundId: String(round.id) });
    const activeClubs = new Set((await db.collection<any>("clubs").find({ state: "ACTIVE" }, { projection: { _id: 1 } }).toArray()).map((club) => String(club._id)));
    const clubs = await db.collection<any>("predictionScores").aggregate([{ $match: { leagueCode: round.leagueCode, seasonStartYear, matchday: roundNumber, clubIdAtLock: { $ne: null } } }, { $group: { _id: "$clubIdAtLock" } }]).toArray();
    for (const club of clubs) { const clubId = String(club._id); if (!activeClubs.has(clubId)) continue; const clubWinner = (await getCanonicalLeaderboard(db, { clubId, leagueCode: round.leagueCode, seasonStartYear, matchday: roundNumber }, 1))[0]; if (!clubWinner || !clubAsset) continue; granted += await issue(db, { awardKey: `ROUND_WINNER:CLUB:${clubId}:${round.leagueCode}:${seasonStartYear}:${roundNumber}`, userId: clubWinner.userId, type: CLUB_ROUND_WINNER_TYPE, scope: "CLUB", competitionId: round.leagueCode, competitionName, seasonId: String(round.seasonId), seasonStartYear, roundId: String(round.id), roundNumber, clubId, points: clubWinner.points, exact: clubWinner.exact, predictions: clubWinner.predictions }, { type: CLUB_ROUND_WINNER_TYPE, scope: "CLUB", clubId, competitionId: round.leagueCode, seasonId: String(round.seasonId), roundId: String(round.id) }); }
  }
  return { rounds: rounds.length, granted };
}

async function grantWeeklyAwards(db: Db) {
  const period = getIranWeeklyPeriod(new Date(), 1); const periodId = period.start.toISOString().slice(0, 10); let granted = 0;
  const winner = (await getCanonicalLeaderboard(db, { weekly: true, weeklyOffset: 1 }, 1))[0];
  if (winner) granted += await issue(db, { awardKey: `WEEKLY_WINNER:${LOWBLOCK_SCOPE}:${periodId}`, userId: winner.userId, type: WEEKLY_WINNER_TYPE, scope: LOWBLOCK_SCOPE, competitionName: "Weekly", periodId });
  const activeClubs = new Set((await db.collection<any>("clubs").find({ state: "ACTIVE" }, { projection: { _id: 1 } }).toArray()).map((club) => String(club._id)));
  const clubs = await db.collection("predictionScores").aggregate([{ $lookup: { from: "matches", localField: "matchId", foreignField: "providerMatchId", as: "fixture" } }, { $unwind: "$fixture" }, { $match: { "fixture.kickoffAt": { $gte: period.start, $lt: period.end }, clubIdAtLock: { $ne: null } } }, { $group: { _id: "$clubIdAtLock" } }]).toArray();
  for (const club of clubs) { const clubId = String(club._id); if (!activeClubs.has(clubId)) continue; const clubWinner = (await getCanonicalLeaderboard(db, { clubId, weekly: true, weeklyOffset: 1 }, 1))[0]; if (!clubWinner) continue; granted += await issue(db, { awardKey: `CLUB_WEEKLY_WINNER:${clubId}:${periodId}`, userId: clubWinner.userId, type: CLUB_WEEKLY_WINNER_TYPE, scope: "CLUB", competitionName: "Club Weekly", periodId }); }
  return granted;
}

async function grantCompletedLeagueAwards(db: Db) {
  const groups = await db.collection<any>("matches").aggregate([{ $match: { matchday: { $gt: 0 } } }, { $group: { _id: { leagueCode: "$leagueCode", seasonStartYear: "$seasonStartYear" }, fixtures: { $push: { status: "$status", homeGoals: "$homeGoals", awayGoals: "$awayGoals" } } } }]).toArray(); let granted = 0;
  let completed = 0;
  for (const group of groups) {
    if (!group.fixtures.length || group.fixtures.some((fixture: any) => !["VOID", "CANCELLED"].includes(String(fixture.status)) && (fixture.status !== "FINISHED" || fixture.homeGoals == null || fixture.awayGoals == null))) continue;
    completed++; const leagueCode = String(group._id.leagueCode); const year = Number(group._id.seasonStartYear); const winner = (await getCanonicalLeaderboard(db, { leagueCode, seasonStartYear: year }, 1))[0]; if (!winner) continue;
    granted += await issue(db, { awardKey: `LEAGUE_WINNER:${LOWBLOCK_SCOPE}:${leagueCode}:${year}`, userId: winner.userId, type: LEAGUE_WINNER_TYPE, scope: LOWBLOCK_SCOPE, competitionId: leagueCode, competitionName: leagueCode, seasonId: String(year), seasonStartYear: year });
    const activeClubs = new Set((await db.collection<any>("clubs").find({ state: "ACTIVE" }, { projection: { _id: 1 } }).toArray()).map((club) => String(club._id)));
    const clubRows = await db.collection<any>("predictionScores").aggregate([{ $match: { leagueCode, seasonStartYear: year, clubIdAtLock: { $ne: null } } }, { $group: { _id: "$clubIdAtLock" } }]).toArray();
    for (const row of clubRows) {
      const clubId = String(row._id); if (!activeClubs.has(clubId)) continue;
      const clubWinner = (await getCanonicalLeaderboard(db, { clubId, leagueCode, seasonStartYear: year }, 1))[0]; if (!clubWinner) continue;
      granted += await issue(db, { awardKey: `CLUB_LEAGUE_WINNER:${clubId}:${leagueCode}:${year}`, userId: clubWinner.userId, type: CLUB_LEAGUE_WINNER_TYPE, scope: "CLUB", competitionId: leagueCode, competitionName: leagueCode, seasonId: String(year), seasonStartYear: year, clubId, points: clubWinner.points, exact: clubWinner.exact, predictions: clubWinner.predictions });
    }
  }
  if (groups.length > 0 && completed === groups.length) { const year = Number(groups[0]._id.seasonStartYear); if (groups.every((group: any) => Number(group._id.seasonStartYear) === year)) { const winner = (await getCanonicalLeaderboard(db, { seasonStartYear: year }, 1))[0]; if (winner) granted += await issue(db, { awardKey: `GLOBAL_WINNER:${year}`, userId: winner.userId, type: GLOBAL_WINNER_TYPE, scope: "GLOBAL", competitionName: "LowBlock Global", seasonId: String(year), seasonStartYear: year }); } }
  return granted;
}

function iranMonthPeriod(now = new Date()) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now); const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""; const currentYear = Number(value("year")); const currentMonth = Number(value("month")); const day = Number(value("day")); const isFirstDay = day === 1; const target = new Date(Date.UTC(currentYear, currentMonth - 1 - (isFirstDay ? 1 : 0), 1)); const year = target.getUTCFullYear(); const month = target.getUTCMonth() + 1; const start = new Date(Date.UTC(year, month - 1, 1) - 210 * 60000); const end = new Date(Date.UTC(year, month, 1) - 210 * 60000); return { start, end, id: `${year}-${String(month).padStart(2, "0")}`, isFirstDay }; }

async function grantMonthlyExactAward(db: Db) {
  const period = iranMonthPeriod(); if (!period.isFirstDay) return 0;
  const base = [{ $lookup: { from: "matches", localField: "matchId", foreignField: "providerMatchId", as: "fixture" } }, { $unwind: "$fixture" }, { $match: { exactScore: true, "fixture.kickoffAt": { $gte: period.start, $lt: period.end } } }];
  const rows = await db.collection("predictionScores").aggregate([...base, { $group: { _id: "$userId", exact: { $sum: 1 } } }, { $sort: { exact: -1, _id: 1 } }, { $limit: 1 }]).toArray(); const winner = rows[0]; let granted = winner ? await issue(db, { awardKey: `MONTHLY_EXACT_WINNER:${period.id}`, userId: String(winner._id), type: MONTHLY_EXACT_WINNER_TYPE, scope: LOWBLOCK_SCOPE, competitionName: "Monthly Exact", periodId: period.id }) : 0;
  const activeClubs = new Set((await db.collection<any>("clubs").find({ state: "ACTIVE" }, { projection: { _id: 1 } }).toArray()).map((club) => String(club._id)));
  const clubRows = await db.collection<any>("predictionScores").aggregate([...base, { $match: { clubIdAtLock: { $ne: null } } }, { $group: { _id: { clubId: "$clubIdAtLock", userId: "$userId" }, exact: { $sum: 1 } } }, { $sort: { exact: -1, "_id.userId": 1 } }]).toArray();
  const awardedClubs = new Set<string>(); for (const row of clubRows) { const clubId = String(row._id.clubId); if (awardedClubs.has(clubId) || !activeClubs.has(clubId)) continue; awardedClubs.add(clubId); granted += await issue(db, { awardKey: `CLUB_MONTHLY_EXACT_WINNER:${clubId}:${period.id}`, userId: String(row._id.userId), type: CLUB_MONTHLY_EXACT_WINNER_TYPE, scope: "CLUB", competitionName: "Club Monthly Exact", periodId: period.id, clubId, exact: row.exact }); }
  return granted;
}

export async function grantAutomaticAwards(db: Db) {
  await ensureAwardIndexes(db);
  const round = await grantFinalRoundWinnerAwards(db);
  const weekly = await grantWeeklyAwards(db);
  const leagues = await grantCompletedLeagueAwards(db);
  const monthly = await grantMonthlyExactAward(db);
  return { round, weekly, leagues, monthly };
}
