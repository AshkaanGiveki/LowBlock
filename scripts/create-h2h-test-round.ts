import { closeMongo, getDb } from "../lib/db/mongo";
import { getH2HWeek, materializeH2HLeague, scoreH2HFixture } from "../lib/domain/h2h";

const names = ["ashkan", "kaka", "mahyar", "raminowskiy"];
async function main() {
  const db = await getDb();
  const allUsers = await db.collection<any>("users").find({}).toArray();
  const users = names.map((name) => allUsers.find((user) => String(user.normalizedUsername ?? user.username).toLowerCase() === name));
  if (users.some((user) => !user)) throw new Error(`Missing test user: ${names[users.findIndex((user) => !user)]}`);
  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + 2);
  endsAt.setHours(23, 59, 59, 999);
  const ratings = new Map((await db.collection<any>("centralTeams").find({ h2hRating: { $gte: 1, $lte: 100 } }).toArray()).map((team) => [String(team.centralTeamId), Number(team.h2hRating)]));
  const matches = await db.collection<any>("matches").find({}).toArray();
  const candidates = matches.filter((match) => {
    const kickoff = new Date(match.kickoffAt); const status = String(match.status ?? "").toUpperCase();
    return kickoff >= startsAt && kickoff <= endsAt && !["FINISHED", "CANCELLED", "POSTPONED", "ABANDONED"].includes(status) && scoreH2HFixture(match, ratings) !== null;
  }).sort((a, b) => scoreH2HFixture(b, ratings)! - scoreH2HFixture(a, ratings)! || new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  if (candidates.length < 15) throw new Error(`Only ${candidates.length} eligible fixtures are available; 15 are required.`);
  const dateKey = (value: Date) => value.toISOString().slice(0, 10);
  const anchors = Array.from({ length: 3 }, (_, index) => { const value = new Date(startsAt); value.setDate(value.getDate() + index); return dateKey(value); });
  const remaining = [...candidates];
  const groups = anchors.map((anchor) => {
    const sameDay = remaining.filter((match) => dateKey(new Date(match.kickoffAt)) === anchor).slice(0, 5);
    for (const match of sameDay) remaining.splice(remaining.indexOf(match), 1);
    const fill = remaining.splice(0, Math.max(0, 5 - sameDay.length));
    return [...sameDay, ...fill].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  });
  if (groups.some((group) => group.length < 5)) throw new Error("Could not produce three five-fixture test slates for the requested date window.");
  const slates = groups.map((group, index) => {
    const fixtures = group.map((match) => ({ matchId: String(match.providerMatchId), kickoffAt: new Date(match.kickoffAt), score: scoreH2HFixture(match, ratings)!, leagueCode: String(match.leagueCode), homeTeam: match.homeTeam, awayTeam: match.awayTeam, homeRating: ratings.get(String(match.homeTeam.centralTeamId)) ?? 0, awayRating: ratings.get(String(match.awayTeam.centralTeamId)) ?? 0, tournamentWeight: 1, ratingVersion: "h2h-team-ratings-review", selectionReason: "test-round-date-anchored" }));
    return { matchday: index + 1, sourceDate: fixtures[0].kickoffAt.toISOString().slice(0, 10), fixtureIds: fixtures.map((fixture) => fixture.matchId), fixtures, firstKickoffAt: fixtures[0].kickoffAt, goldDeadline: fixtures[0].kickoffAt };
  });
  const week = getH2HWeek(startsAt);
  const now = new Date();
  const doc = { clubId: "H2H_TEST_ROUND", weekKey: week.key, startsAt, endsAt, groupNumber: 999, players: users.map((user) => String(user._id)), slates, status: "ACTIVE", testRound: true, winnerUserId: null, cancelledReason: null, createdAt: now, updatedAt: now };
  await db.collection("h2hLeagues").deleteMany({ testRound: true, status: "ACTIVE" });
  const result = await db.collection("h2hLeagues").insertOne(doc);
  await materializeH2HLeague(db, { ...doc, _id: result.insertedId });
  console.log(JSON.stringify({ leagueId: result.insertedId.toHexString(), users: users.map((user) => user.username), startsAt, endsAt, matchdays: slates.map((slate) => slate.fixtureIds) }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeMongo().catch(() => undefined));
