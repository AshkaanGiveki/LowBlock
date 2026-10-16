import { closeMongo, getDb } from "../lib/db/mongo";
import { H2H_TOURNAMENT_WEIGHTS, materializeH2HLeague, scoreH2HFixture } from "../lib/domain/h2h";

const TERMINAL = new Set(["FINISHED", "CANCELLED", "POSTPONED", "ABANDONED"]);

async function main() {
  const db = await getDb();
  const league = await db.collection<any>("h2hLeagues").findOne(
    { clubId: "H2H_TEST_ROUND", testRound: true, status: "ACTIVE" },
    { sort: { updatedAt: -1 } },
  );
  if (!league) throw new Error("No active H2H test round found.");

  const ratings = new Map(
    (await db.collection<any>("centralTeams").find({ h2hRating: { $gte: 1, $lte: 100 } }).toArray())
      .map((team) => [String(team.centralTeamId), Number(team.h2hRating)] as const),
  );
  const matches = await db.collection<any>("matches").find({}).toArray();
  const now = new Date();
  const used = new Set<string>(
    league.slates
      .filter((slate: any) => new Date(slate.firstKickoffAt) <= now)
      .flatMap((slate: any) => slate.fixtureIds.map(String)),
  );
  const changed: any[] = [];

  for (const slate of league.slates) {
    if (new Date(slate.firstKickoffAt) <= now) continue;
    const sourceDate = String(slate.sourceDate);
    const candidates = matches
      .filter((match) => {
        const kickoff = new Date(match.kickoffAt);
        const score = scoreH2HFixture(match, ratings);
        return kickoff.toISOString().slice(0, 10) === sourceDate &&
          kickoff > now &&
          !TERMINAL.has(String(match.status ?? "").toUpperCase()) &&
          score !== null &&
          !used.has(String(match.providerMatchId));
      })
      .sort((a, b) => scoreH2HFixture(b, ratings)! - scoreH2HFixture(a, ratings)! || new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())
      .slice(0, 5);
    if (candidates.length < 4) throw new Error(`Only ${candidates.length} valid future fixtures remain for ${sourceDate}.`);

    const fixtures = candidates.map((match) => ({
      matchId: String(match.providerMatchId),
      kickoffAt: new Date(match.kickoffAt),
      score: scoreH2HFixture(match, ratings)!,
      leagueCode: String(match.leagueCode),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeRating: ratings.get(String(match.homeTeam?.centralTeamId)) ?? 0,
      awayRating: ratings.get(String(match.awayTeam?.centralTeamId)) ?? 0,
      tournamentWeight: H2H_TOURNAMENT_WEIGHTS[String(match.leagueCode)] ?? 1,
      ratingVersion: "h2h-team-ratings-review",
      selectionReason: "test-round-repaired-from-complete-week-discovery",
    }));
    slate.fixtureIds = fixtures.map((fixture) => fixture.matchId);
    slate.fixtures = fixtures;
    slate.firstKickoffAt = fixtures[0].kickoffAt;
    slate.goldDeadline = fixtures[0].kickoffAt;
    for (const fixture of fixtures) used.add(fixture.matchId);
    changed.push({ matchday: slate.matchday, sourceDate, fixtureIds: slate.fixtureIds, scores: fixtures.map((fixture) => fixture.score) });
  }

  if (changed.length) {
    await db.collection("h2hLeagues").updateOne({ _id: league._id }, { $set: { slates: league.slates, updatedAt: new Date() } });
    await db.collection("h2hSlateFixtures").deleteMany({ leagueId: league._id, matchday: { $in: changed.map((item) => item.matchday) } });
    await materializeH2HLeague(db, { ...league, slates: league.slates, updatedAt: new Date() });
  }
  console.log(JSON.stringify({ leagueId: String(league._id), changed }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeMongo().catch(() => undefined));
