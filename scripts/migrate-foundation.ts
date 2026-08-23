import { ensureIndexes, getDb } from "../lib/db/mongo";
import { env } from "../lib/env";

async function main() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const db = await getDb();
  await ensureIndexes();
  const matches = db.collection<any>("matches");
  const before = { users: await db.collection("users").countDocuments(), matches: await matches.countDocuments(), predictions: await db.collection("predictions").countDocuments(), scores: await db.collection("predictionScores").countDocuments() };
  const cursor = matches.find({ matchday: { $gt: 0 } }, { projection: { leagueCode: 1, seasonStartYear: 1, matchday: 1, kickoffAt: 1, status: 1 } });
  const roundOps = new Map<string, any>();
  for await (const match of cursor) {
    const seasonId = String(match.seasonStartYear);
    await db.collection("seasons").updateOne({ startYear: match.seasonStartYear }, { $set: { id: seasonId, label: `${match.seasonStartYear}/${String(match.seasonStartYear + 1).slice(-2)}`, startsAt: new Date(`${match.seasonStartYear}-07-01T00:00:00Z`), endsAt: new Date(`${match.seasonStartYear + 1}-06-30T23:59:59Z`) } }, { upsert: true });
    const leagueSeasonId = `${match.leagueCode}:${seasonId}`;
    await db.collection("leagueSeasons").updateOne({ id: leagueSeasonId }, { $set: { id: leagueSeasonId, leagueCode: match.leagueCode, seasonId } }, { upsert: true });
    const roundId = `${leagueSeasonId}:${match.matchday}`;
    const key = roundId;
    const current = roundOps.get(key) ?? { leagueSeasonId, leagueCode: match.leagueCode, seasonId, number: match.matchday, name: `Round ${match.matchday}`, scheduledStart: null, scheduledEnd: null, status: "UPCOMING", completedFixtures: 0, eligibleFixtures: 0 };
    const kickoff = new Date(match.kickoffAt);
    current.scheduledStart = !current.scheduledStart || kickoff < current.scheduledStart ? kickoff : current.scheduledStart;
    current.scheduledEnd = !current.scheduledEnd || kickoff > current.scheduledEnd ? kickoff : current.scheduledEnd;
    current.eligibleFixtures += match.status === "VOID" || match.status === "CANCELLED" ? 0 : 1;
    current.completedFixtures += match.status === "FINISHED" ? 1 : 0;
    roundOps.set(key, current);
    await matches.updateOne({ _id: match._id }, { $set: { roundId } });
  }
  for (const [id, round] of roundOps) { const status = round.completedFixtures === round.eligibleFixtures && round.eligibleFixtures > 0 ? "FINAL" : round.completedFixtures > 0 ? "PENDING" : "UPCOMING"; await db.collection("rounds").updateOne({ id }, { $set: { id, ...round, status, updatedAt: new Date() } }, { upsert: true }); }
  const after = { users: await db.collection("users").countDocuments(), matches: await matches.countDocuments(), predictions: await db.collection("predictions").countDocuments(), scores: await db.collection("predictionScores").countDocuments() };
  console.log(JSON.stringify({ before, after, preserved: Object.keys(before).every(key => before[key as keyof typeof before] === after[key as keyof typeof after]), rounds: roundOps.size }, null, 2));
}
main().catch(error => { console.error(error); process.exit(1); });

