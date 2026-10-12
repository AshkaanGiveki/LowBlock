import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { calculatePredictionScore } from "@/lib/scoring/calculatePredictionScore";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { currentUserId } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { providerWeekDateKeys } from "@/lib/football/scheduleWindow";
import { ensureH2HIndexes } from "@/lib/db/mongo";
import ratingsData from "@/data/h2h-team-ratings-review.json";

export const H2H_TOURNAMENT_WEIGHTS: Record<string, number> = {
  UCL: 1.20, GB1: 1.18, ES1: 1.16, IT1: 1.14, L1: 1.12, UEL: 1.12,
  FR1: 1.10, SA1: 1.08, ACLE: 1.08, TR1: 1.07, NATIONS: 1.07,
  GB2: 1.05, IR1: 1.04, FRIENDLY: 1.00,
};

type RatingRow = { teamId?: string; centralTeamId?: string; rating: number };
const ratings = new Map<string, number>(
  (ratingsData.teams as RatingRow[]).flatMap((row) => {
    const id = row.centralTeamId ?? row.teamId;
    return id && Number.isFinite(row.rating) ? [[String(id), row.rating] as const] : [];
  }),
);

export type H2HWeek = { key: string; start: Date; end: Date };
export type H2HFixture = {
  matchId: string;
  kickoffAt: Date;
  score: number;
  leagueCode: string;
  homeTeam: any;
  awayTeam: any;
  homeRating: number;
  awayRating: number;
  tournamentWeight: number;
  ratingVersion: string;
  selectionReason: string;
};
export type H2HSlate = {
  matchday: number;
  sourceDate: string;
  fixtureIds: string[];
  fixtures: H2HFixture[];
  firstKickoffAt: Date;
  goldDeadline: Date;
};

export type H2HPairing = { playerA: string; playerB: string };

/** One opponent per player per slate, with Seed 1 vs Seed 2 in the final slate. */
export function buildH2HPairings(playerIds: string[], roundIndex: number): H2HPairing[] {
  const ids = playerIds.map(String);
  if (ids.length < 2 || ids.length % 2 !== 0) return [];
  const rotating = ids.slice(1);
  const shift = ((roundIndex % rotating.length) + rotating.length) % rotating.length;
  const order = [ids[0], ...rotating.slice(rotating.length - shift), ...rotating.slice(0, rotating.length - shift)];
  const pairings: H2HPairing[] = [];
  for (let index = 0; index < order.length / 2; index++)
    pairings.push({ playerA: order[index], playerB: order[order.length - 1 - index] });
  return pairings;
}

export function isH2HEnabled() { return env.H2H_ENABLED; }

export function getH2HWeek(now = new Date(), offset = 0): H2HWeek {
  const zone = (() => { try { new Intl.DateTimeFormat("en-CA", { timeZone: env.APP_TIMEZONE }).format(now); return env.APP_TIMEZONE; } catch { return "UTC"; } })();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const local = new Date(Date.UTC(values.year, values.month - 1, values.day + offset * 7));
  const daysSinceFriday = (local.getUTCDay() + 2) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceFriday);
  const toUtc = (date: Date) => {
    const rough = new Date(date);
    const offsetParts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(rough);
    const p = Object.fromEntries(offsetParts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const zoneAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const offsetMs = zoneAsUtc - rough.getTime();
    return new Date(date.getTime() - offsetMs);
  };
  const start = toUtc(local);
  const end = new Date(start.getTime() + 7 * 86400000);
  return { key: local.toISOString().slice(0, 10), start, end };
}

function dayKey(value: Date) { return value.toISOString().slice(0, 10); }
function dayIndex(value: Date, start: Date) {
  return Math.max(0, Math.min(6, Math.floor((value.getTime() - start.getTime()) / 86400000)));
}
function kickoff(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function scoreH2HFixture(match: any, ratingMap: Map<string, number> = ratings): number | null {
  const code = String(match.leagueCode ?? "");
  const homeId = String(match.homeTeam?.centralTeamId ?? "");
  const awayId = String(match.awayTeam?.centralTeamId ?? "");
  const home = ratingMap.get(homeId) ?? 0;
  const away = ratingMap.get(awayId) ?? 0;
  const weight = H2H_TOURNAMENT_WEIGHTS[code] ?? 1;
  const score = (home + away) * weight;
  return score > 0 ? score : null;
}

function selectable(match: any, week: H2HWeek, ratingMap: Map<string, number>) {
  const date = kickoff(match.kickoffAt);
  const status = String(match.status ?? "").toUpperCase();
  return Boolean(
    date && date >= week.start && date < week.end &&
      !["FINISHED", "CANCELLED", "POSTPONED", "ABANDONED"].includes(status) &&
      scoreH2HFixture(match, ratingMap) !== null,
  );
}

export function buildH2HSlates(matches: any[], week: H2HWeek, ratingMap: Map<string, number> = ratings): H2HSlate[] {
  const candidates = matches
    .filter((match) => selectable(match, week, ratingMap))
    .map((match) => ({
      match,
      date: kickoff(match.kickoffAt)!,
      score: scoreH2HFixture(match, ratingMap)!,
      id: String(match.providerMatchId),
    }))
    .filter((row, index, rows) => rows.findIndex((other) => other.id === row.id) === index)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || b.score - a.score || a.id.localeCompare(b.id));
  const byDay = Array.from({ length: 7 }, () => [] as typeof candidates);
  for (const row of candidates) byDay[dayIndex(row.date, week.start)].push(row);
  const slates: H2HSlate[] = [];
  for (let matchday = 1; matchday <= 7; matchday++) {
    const dayCandidates = byDay[matchday - 1];
    if (dayCandidates.length < 4) return [];
    const sourceDay = dayKey(dayCandidates[0].date);
    const chosen = [...dayCandidates]
      .sort((a, b) => b.score - a.score || a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id))
      .slice(0, 5);
    chosen.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    const firstKickoffAt = chosen[0].date;
    slates.push({
      matchday,
      sourceDate: sourceDay,
      fixtureIds: chosen.map((row) => row.id),
      fixtures: chosen.map((row) => ({
        matchId: row.id,
        kickoffAt: row.date,
        score: row.score,
        leagueCode: String(row.match.leagueCode),
        homeTeam: row.match.homeTeam,
        awayTeam: row.match.awayTeam,
        homeRating: ratingMap.get(String(row.match.homeTeam?.centralTeamId ?? row.match.homeTeam?.teamId)) ?? 0,
        awayRating: ratingMap.get(String(row.match.awayTeam?.centralTeamId ?? row.match.awayTeam?.teamId)) ?? 0,
        tournamentWeight: H2H_TOURNAMENT_WEIGHTS[String(row.match.leagueCode)],
        ratingVersion: "h2h-team-ratings-review",
      selectionReason: "highest-score-with-four-to-five-daily-target",
      })),
      firstKickoffAt,
      goldDeadline: firstKickoffAt,
    });
  }
  return slates.length === 7 && slates.every((slate) => slate.fixtures.length >= 4) ? slates : [];
}

async function memberIds(db: Db, clubId: string) {
  const members = await db.collection<any>("clubMemberships")
    .find({ clubId, leftAt: null }, { projection: { userId: 1 } }).toArray();
  return members.map((member) => String(member.userId));
}

async function loadCentralH2HRatings(db: Db) {
  const rows = await db.collection<any>("centralTeams").find({ h2hRating: { $gte: 1, $lte: 100 } }, { projection: { centralTeamId: 1, h2hRating: 1 } }).toArray();
  return new Map(rows.map((row) => [String(row.centralTeamId), Number(row.h2hRating)]));
}

async function hasCompleteWeeklyDiscovery(db: Db, week: H2HWeek) {
  const dates = providerWeekDateKeys(week.start);
  return Boolean(await db.collection<any>("sportsApiDiscoveryManifests").findOne({ kind: "weekly", dates, status: "COMPLETE" }));
}

async function eligibleUsers(db: Db, ids: string[], weekKey: string) {
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const users = await db.collection<any>("users").find({ _id: { $in: objectIds } }, {
    projection: { h2hOptOut: 1, h2hOptOutEffectiveWeekKey: 1 },
  }).toArray();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  return ids.filter((id) => {
    const user = byId.get(id);
    return !(user?.h2hOptOut === true && String(user.h2hOptOutEffectiveWeekKey ?? "") <= weekKey);
  });
}

export async function selectH2HPlayers(db: Db, clubId: string, week: H2HWeek) {
  const ids = await eligibleUsers(db, await memberIds(db, clubId), week.key);
  const previous = getH2HWeek(week.start, 1);
  const previousLeague = await db.collection<any>("h2hLeagues").findOne(
    { clubId, weekKey: previous.key, groupNumber: 1, status: "COMPLETED" },
    { projection: { winnerUserId: 1 } },
  );
  const rows = await getCanonicalLeaderboard(db, { clubId, weekly: true, weeklyOffset: 1 }, Math.max(100, ids.length));
  const idSet = new Set(ids);
  const picked: string[] = [];
  if (previousLeague?.winnerUserId && idSet.has(String(previousLeague.winnerUserId))) picked.push(String(previousLeague.winnerUserId));
  for (const row of rows) if (idSet.has(row.userId) && !picked.includes(row.userId)) picked.push(row.userId);
  for (const id of ids) if (!picked.includes(id)) picked.push(id);
  return picked.slice(0, 8);
}

export async function createH2HLeague(db: Db, clubId: string, week: H2HWeek) {
  if (!isH2HEnabled()) return null;
  const existing = await db.collection<any>("h2hLeagues").findOne({ clubId, weekKey: week.key, groupNumber: 1 });
  if (existing) return null;
  if (!(await hasCompleteWeeklyDiscovery(db, week))) return null;
  const players = await selectH2HPlayers(db, clubId, week);
  if (players.length < 8) return null;
  const matches = await db.collection<any>("matches").find({
    kickoffAt: { $gte: week.start, $lt: week.end },
  }).toArray();
  const slates = buildH2HSlates(matches, week, await loadCentralH2HRatings(db));
  if (!slates.length) return null;
  const now = new Date();
  const doc = {
    clubId, weekKey: week.key, startsAt: week.start, endsAt: week.end, groupNumber: 1,
    players, slates, status: "ACTIVE", winnerUserId: null, cancelledReason: null,
    createdAt: now, updatedAt: now,
  };
  await db.collection("h2hLeagues").insertOne(doc);
  const created = await db.collection<any>("h2hLeagues").findOne({ clubId, weekKey: week.key, groupNumber: 1 });
  if (created) await materializeH2HLeague(db, created);
  return created;
}

export async function materializeH2HLeague(db: Db, league: any) {
  const now = new Date();
  await db.collection("h2hWeeks").updateOne(
    { weekKey: league.weekKey },
    { $set: { weekKey: league.weekKey, startsAt: league.startsAt, endsAt: league.endsAt, status: "ACTIVE", selectedFixtureCount: league.slates.reduce((n: number, s: H2HSlate) => n + s.fixtures.length, 0), updatedAt: now }, $setOnInsert: { createdAt: now, scheduleVersion: 1 } },
    { upsert: true },
  );
  const week = await db.collection<any>("h2hWeeks").findOne({ weekKey: league.weekKey });
  if (!week) return;
  for (const [index, userId] of league.players.map(String).entries()) {
    await db.collection("h2hLeagueMembers").updateOne({ leagueId: league._id, userId }, { $set: { leagueId: league._id, weekId: week._id, clubId: league.clubId, weekKey: league.weekKey, groupNumber: league.groupNumber, userId, selectionReason: index === 0 && league.groupNumber === 1 ? "PREVIOUS_H2H_WINNER_OR_CLUB_LEADERBOARD" : "CLUB_LEADERBOARD_OR_NEXT_ELIGIBLE", createdAt: now }, $setOnInsert: { joinedAt: now } }, { upsert: true });
  }
  for (const slate of league.slates as H2HSlate[]) for (const fixture of slate.fixtures) {
    await db.collection("h2hSlateFixtures").updateOne({ weekId: week._id, matchId: fixture.matchId }, { $set: { weekId: week._id, leagueId: league._id, matchday: slate.matchday, matchId: fixture.matchId, kickoffAt: fixture.kickoffAt, score: fixture.score, leagueCode: fixture.leagueCode, homeCentralTeamId: fixture.homeTeam?.centralTeamId ?? null, awayCentralTeamId: fixture.awayTeam?.centralTeamId ?? null, homeRating: fixture.homeRating, awayRating: fixture.awayRating, tournamentWeight: fixture.tournamentWeight, ratingVersion: fixture.ratingVersion, selectionReason: fixture.selectionReason, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
  }
  await db.collection("h2hAuditEvents").updateOne({ eventKey: `SCHEDULE_CREATED:${league._id}` }, { $setOnInsert: { eventKey: `SCHEDULE_CREATED:${league._id}`, leagueId: league._id, type: "SCHEDULE_CREATED", createdAt: now, fixtureCount: league.slates.reduce((n: number, s: H2HSlate) => n + s.fixtures.length, 0) } }, { upsert: true });
  for (const userId of league.players.map(String)) await db.collection("notificationDeliveries").updateOne({ userId, matchId: `H2H:${league._id}`, channel: "IN_APP", type: "H2H_ROSTER_PUBLISHED" }, { $setOnInsert: { userId, matchId: `H2H:${league._id}`, type: "H2H_ROSTER_PUBLISHED", leagueId: league._id, channel: "IN_APP", status: "PENDING", createdAt: now } }, { upsert: true });
}

export async function ensureCurrentH2HLeagues(db: Db) {
  if (!isH2HEnabled()) return { enabled: false, created: 0 };
  await ensureH2HIndexes();
  const week = getH2HWeek();
  await settleH2HLeagues(db, getH2HWeek(new Date(), 1).key);
  const clubs = await db.collection<any>("clubs").find({ state: "ACTIVE" }, { projection: { _id: 1 } }).toArray();
  let created = 0;
  for (const club of clubs) {
    const clubId = String(club._id);
    const existingPrimary = await db.collection<any>("h2hLeagues").findOne({ clubId, weekKey: week.key, groupNumber: 1 });
    const primary = existingPrimary ?? await createH2HLeague(db, clubId, week);
    if (primary) await materializeH2HLeague(db, primary);
    if (primary) created++;
    // Larger Clubs get additional independent eight-player groups. The primary
    // group retains the previous H2H winner + Club-leaderboard qualification;
    // subsequent groups use the next eligible Club members.
    const allIds = await eligibleUsers(db, await memberIds(db, clubId), week.key);
    const primaryIds = new Set<string>(primary?.players?.map(String) ?? []);
    const rows = await getCanonicalLeaderboard(db, { clubId, weekly: true, weeklyOffset: 1 }, Math.max(100, allIds.length));
    const ordered = [...rows.map((row) => row.userId), ...allIds].filter((id, index, list) => allIds.includes(id) && !primaryIds.has(id) && list.indexOf(id) === index);
    for (let offset = 0, groupNumber = 2; offset + 8 <= ordered.length; offset += 8, groupNumber++) {
      if (await db.collection("h2hLeagues").findOne({ clubId, weekKey: week.key, groupNumber })) continue;
      if (!(await hasCompleteWeeklyDiscovery(db, week))) break;
      const players = ordered.slice(offset, offset + 8);
      const matches = await db.collection<any>("matches").find({ kickoffAt: { $gte: week.start, $lt: week.end } }).toArray();
      const slates = buildH2HSlates(matches, week, await loadCentralH2HRatings(db));
      if (!slates.length) break;
      const result = await db.collection("h2hLeagues").insertOne({ clubId, weekKey: week.key, startsAt: week.start, endsAt: week.end, groupNumber, players, slates, status: "ACTIVE", winnerUserId: null, cancelledReason: null, createdAt: new Date(), updatedAt: new Date() });
      await materializeH2HLeague(db, { _id: result.insertedId, clubId, weekKey: week.key, startsAt: week.start, endsAt: week.end, groupNumber, players, slates });
      created++;
    }
  }
  const weekLeagues = await db.collection<any>("h2hLeagues").countDocuments({ weekKey: week.key });
  if (!weekLeagues) await db.collection("h2hWeeks").updateOne({ weekKey: week.key }, { $set: { weekKey: week.key, startsAt: week.start, endsAt: week.end, status: "CANCELLED", cancelledReason: "NO_VALID_EIGHT_PLAYER_LEAGUE_OR_SCHEDULE", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return { enabled: true, created, weekKey: week.key };
}

export async function settleH2HLeagues(db: Db, weekKey = getH2HWeek().key) {
  const leagues = await db.collection<any>("h2hLeagues").find({ weekKey, status: "ACTIVE" }).toArray();
  let completed = 0;
  for (const league of leagues) {
    const standings = await calculateH2HStandings(db, league);
    if (new Date() < new Date(league.endsAt)) continue;
    const winner = standings[0];
    await db.collection("h2hStandings").deleteMany({ leagueId: league._id });
    if (standings.length) {
      const played = league.slates.length;
      await db.collection("h2hStandings").insertMany(standings.map((row: any) => ({ ...row, leagueId: league._id, played, totalSlatePoints: row.predictionPoints, normalizedAveragePoints: played ? row.predictionPoints / played : 0, scoreDifference: row.wins - row.losses, exactPredictions: 0, goldSelections: 0, goldWins: 0, qualificationStatus: row.rank <= 7 ? "QUALIFIED" : "NOT_QUALIFIED", createdAt: new Date(), updatedAt: new Date() })));
      const operations = [] as any[];
      for (const slate of league.slates as H2HSlate[]) for (const pairing of buildH2HPairings(league.players.map(String), slate.matchday - 1)) {
        const a = standings.find((row: any) => row.userId === pairing.playerA);
        const b = standings.find((row: any) => row.userId === pairing.playerB);
        const as = a?.slateScores?.[String(slate.matchday)] ?? 0; const bs = b?.slateScores?.[String(slate.matchday)] ?? 0;
        operations.push({ updateOne: { filter: { leagueId: league._id, matchday: slate.matchday, playerPair: `${a?.userId}:${b?.userId}` }, update: { $set: { leagueId: league._id, matchday: slate.matchday, playerPair: `${a?.userId}:${b?.userId}`, playerA: a?.userId, playerB: b?.userId, scoreA: as, scoreB: bs, winnerUserId: as === bs ? null : as > bs ? a?.userId : b?.userId, status: "FINAL", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, upsert: true } });
      }
      if (operations.length) await db.collection("h2hMatchResults").bulkWrite(operations);
    }
    if (winner) await db.collection("h2hRewards").updateOne({ leagueId: league._id, userId: winner.userId, rewardType: "PREVIOUS_H2H_WINNER" }, { $set: { leagueId: league._id, userId: winner.userId, rewardType: "PREVIOUS_H2H_WINNER", rank: 1, createdAt: new Date() }, $setOnInsert: { ticketId: new ObjectId().toHexString() } }, { upsert: true });
    await db.collection("h2hLeagues").updateOne({ _id: league._id, status: "ACTIVE" }, { $set: { status: "COMPLETED", winnerUserId: winner?.userId ?? null, completedAt: new Date(), updatedAt: new Date() } });
    await db.collection("h2hAuditEvents").updateOne({ eventKey: `SETTLED:${league._id}` }, { $setOnInsert: { eventKey: `SETTLED:${league._id}`, leagueId: league._id, type: "LEAGUE_COMPLETED", createdAt: new Date(), winnerUserId: winner?.userId ?? null } }, { upsert: true });
    completed++;
  }
  return { weekKey, completed };
}

export async function calculateH2HStandings(db: Db, league: any) {
  const ids = league.players.map(String);
  const fixtureIds = league.slates.flatMap((slate: H2HSlate) => slate.fixtureIds);
  const [matches, predictions, gold] = await Promise.all([
    db.collection<any>("matches").find({ providerMatchId: { $in: fixtureIds } }).toArray(),
    db.collection<any>("predictions").find({ userId: { $in: ids }, matchId: { $in: fixtureIds } }).toArray(),
    db.collection<any>("h2hGoldPicks").find({ leagueId: league._id }).toArray(),
  ]);
  const byMatch = new Map(matches.map((match) => [String(match.providerMatchId), match]));
  const byPrediction = new Map(predictions.map((prediction) => [`${prediction.userId}:${prediction.matchId}`, prediction]));
  const byGold = new Set(gold.map((pick) => `${pick.userId}:${pick.matchday}:${pick.matchId}`));
  type Standing = { userId: string; h2hPoints: number; wins: number; draws: number; losses: number; predictionPoints: number };
  const totals = new Map<string, Standing & { slateScores: Record<string, number> }>(ids.map((id: string) => [id, { userId: id, h2hPoints: 0, wins: 0, draws: 0, losses: 0, predictionPoints: 0, slateScores: {} }]));
  for (const slate of league.slates as H2HSlate[]) {
    const slateMatches = slate.fixtureIds.map((matchId) => byMatch.get(matchId)).filter(Boolean);
    const slateComplete = slateMatches.length === slate.fixtureIds.length && slateMatches.every((match: any) => match.homeGoals != null && match.awayGoals != null);
    if (!slateComplete) continue;
    const slateScores = new Map<string, number>();
    for (const id of ids) {
      let score = 0;
      for (const matchId of slate.fixtureIds) {
        const match = byMatch.get(matchId);
        const prediction = byPrediction.get(`${id}:${matchId}`);
        if (!match || !prediction || match.homeGoals == null || match.awayGoals == null) continue;
        const points = calculatePredictionScore(prediction.homeGoals, prediction.awayGoals, match.homeGoals, match.awayGoals).points;
        score += points * (byGold.has(`${id}:${slate.matchday}:${matchId}`) ? 2 : 1);
      }
      slateScores.set(id, score);
      totals.get(id)!.slateScores[String(slate.matchday)] = score;
      totals.get(id)!.predictionPoints += score;
    }
    for (const pairing of buildH2HPairings(ids, slate.matchday - 1)) {
      const a = totals.get(pairing.playerA)!, b = totals.get(pairing.playerB)!;
      const as = slateScores.get(a.userId)!, bs = slateScores.get(b.userId)!;
      if (as > bs) { a.h2hPoints += 3; a.wins++; b.losses++; }
      else if (bs > as) { b.h2hPoints += 3; b.wins++; a.losses++; }
      else { a.h2hPoints++; b.h2hPoints++; a.draws++; b.draws++; }
    }
  }
  return [...totals.values()].sort((a, b) => b.h2hPoints - a.h2hPoints || b.wins - a.wins || b.predictionPoints - a.predictionPoints || a.userId.localeCompare(b.userId)).map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function publicH2HLeague(db: Db, league: any, viewerId: string) {
  const standings = await calculateH2HStandings(db, league);
  const users = await db.collection<any>("users").find({ _id: { $in: league.players.filter(ObjectId.isValid).map((id: string) => new ObjectId(id)) } }, { projection: { username: 1, avatarUrl: 1 } }).toArray();
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const fixtureIds = league.slates.flatMap((slate: H2HSlate) => slate.fixtureIds);
  const [predictions, revealed, matchRows, goldPicks] = await Promise.all([
    db.collection<any>("predictions").find({ userId: viewerId, matchId: { $in: fixtureIds } }, { projection: { matchId: 1, homeGoals: 1, awayGoals: 1 } }).toArray(),
    db.collection<any>("predictions").find({ userId: { $in: league.players }, matchId: { $in: fixtureIds } }, { projection: { userId: 1, matchId: 1, homeGoals: 1, awayGoals: 1 } }).toArray(),
    db.collection<any>("matches").find({ provider: "sportsapi", providerMatchId: { $in: fixtureIds } }, { projection: { providerMatchId: 1, status: 1, homeGoals: 1, awayGoals: 1 } }).toArray(),
    db.collection<any>("h2hGoldPicks").find({ leagueId: league._id }, { projection: { userId: 1, matchday: 1, matchId: 1 } }).toArray(),
  ]);
  const matchById = new Map(matchRows.map((match) => [String(match.providerMatchId), match]));
  const playerById = new Map(league.players.map((id: string) => [String(id), { userId: String(id), username: userById.get(String(id))?.username ?? "LowBlock Player", avatarUrl: userById.get(String(id))?.avatarUrl ?? null }]));
  const predictionByKey = new Map(predictions.map((prediction: any) => [`${viewerId}:${String(prediction.matchId)}`, prediction]));
  for (const prediction of revealed) predictionByKey.set(`${String(prediction.userId)}:${String(prediction.matchId)}`, prediction);
  const goldByPlayerSlate = new Map(goldPicks.map((pick: any) => [`${String(pick.userId)}:${Number(pick.matchday)}`, String(pick.matchId)]));
  const h2hMatches = league.slates.map((slate: H2HSlate) => ({
    matchday: slate.matchday,
    pairings: buildH2HPairings(league.players.map(String), slate.matchday - 1).map((pairing) => {
      const fixtureDetails = slate.fixtures.map((fixture) => {
        const match = matchById.get(String(fixture.matchId));
        const finished = ["FINISHED", "FT", "AET", "PEN"].includes(String(match?.status ?? "").toUpperCase()) || (match?.homeGoals != null && match?.awayGoals != null);
        const aPrediction = predictionByKey.get(`${pairing.playerA}:${fixture.matchId}`);
        const bPrediction = predictionByKey.get(`${pairing.playerB}:${fixture.matchId}`);
        const scoreFor = (prediction: any) => finished ? calculatePredictionScore(prediction?.homeGoals ?? null, prediction?.awayGoals ?? null, match?.homeGoals ?? null, match?.awayGoals ?? null) : { points: 0, category: "NO_PREDICTION" as const };
        return { ...fixture, status: match?.status ?? "SCHEDULED", homeGoals: match?.homeGoals ?? null, awayGoals: match?.awayGoals ?? null, isGold: { playerA: goldByPlayerSlate.get(`${pairing.playerA}:${slate.matchday}`) === fixture.matchId, playerB: goldByPlayerSlate.get(`${pairing.playerB}:${slate.matchday}`) === fixture.matchId }, predictions: { playerA: finished || pairing.playerA === viewerId ? aPrediction ?? null : null, playerB: finished || pairing.playerB === viewerId ? bPrediction ?? null : null }, scores: { playerA: scoreFor(aPrediction), playerB: scoreFor(bPrediction) } };
      });
      const scoreA = fixtureDetails.reduce((sum, fixture) => sum + fixture.scores.playerA.points, 0);
      const scoreB = fixtureDetails.reduce((sum, fixture) => sum + fixture.scores.playerB.points, 0);
      return { playerA: playerById.get(pairing.playerA), playerB: playerById.get(pairing.playerB), scoreA, scoreB, winner: scoreA === scoreB ? null : scoreA > scoreB ? pairing.playerA : pairing.playerB, fixtures: fixtureDetails };
    }),
  }));
  const goldBySlate = new Map(goldPicks.filter((pick: any) => String(pick.userId) === viewerId).map((pick: any) => [Number(pick.matchday), String(pick.matchId)]));
  return {
    id: String(league._id), clubId: league.clubId, weekKey: league.weekKey, startsAt: league.startsAt, endsAt: league.endsAt, viewerId,
    status: league.status,
    players: league.players.map((id: string) => ({ userId: id, username: userById.get(id)?.username ?? "LowBlock Player", avatarUrl: userById.get(id)?.avatarUrl ?? null })),
    standings: standings.map(({ slateScores: _slateScores, ...row }: any) => ({ ...row, username: userById.get(row.userId)?.username ?? "LowBlock Player", avatarUrl: userById.get(row.userId)?.avatarUrl ?? null })),
    h2hMatches,
    slates: league.slates.map((slate: H2HSlate) => ({ ...slate, fixtures: slate.fixtures.map((fixture) => ({ ...fixture, kickoffAt: fixture.kickoffAt, prediction: predictions.find((p) => String(p.matchId) === fixture.matchId) ?? null, opponentPredictions: new Date() >= new Date(fixture.kickoffAt) ? revealed.filter((p) => String(p.matchId) === fixture.matchId && String(p.userId) !== viewerId) : [], isGold: goldBySlate.get(slate.matchday) === fixture.matchId })) })),
  };
}
