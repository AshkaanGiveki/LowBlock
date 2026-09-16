import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { LEAGUES } from "../lib/football/leagues";

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined)
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

type Fixture = {
  fixture: { id: number; date: string };
  league: { id: number; name: string };
  teams: { home: { name: string }; away: { name: string } };
};
const supportedLeagues = new Map<number, string>(
  LEAGUES.map(
    (league) => [Number(league.apiLeagueId), league.code] as [number, string],
  ),
);
const date = "2026-09-05";
const start = new Date(`${date}T00:00:00+03:30`);
const bounds = { $gte: start, $lt: new Date(start.getTime() + 86_400_000) };

loadLocalEnv();
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not configured");

const payload = JSON.parse(
  readFileSync(`data/todays-matches-${date}.json`, "utf8"),
) as { response: Fixture[] };
const expected = payload.response.filter((fixture) =>
  supportedLeagues.has(fixture.league.id),
);
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
});

async function main() {
  await client.connect();
  const db = client.db();
  const stored = await db
    .collection<any>("matches")
    .find(
      { kickoffAt: bounds, provider: "football-api" },
      {
        projection: {
          providerMatchId: 1,
          leagueCode: 1,
          kickoffAt: 1,
          homeTeam: 1,
          awayTeam: 1,
          rawApiResponse: 1,
          apiDataType: 1,
        },
      },
    )
    .toArray();
  const pageRecords = [...stored]
    .sort(
      (a, b) =>
        new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    )
    .slice(0, 100);
  const storedIds = new Set(
    stored.map((match) => String(match.providerMatchId)),
  );
  const missing = expected.filter(
    (fixture) => !storedIds.has(String(fixture.fixture.id)),
  );
  const importedApiRecords = await db
    .collection<any>("matches")
    .find(
      {
        provider: "football-api",
        providerMatchId: {
          $in: payload.response.map((fixture) => String(fixture.fixture.id)),
        },
      },
      { projection: { providerMatchId: 1 } },
    )
    .toArray();
  const importedIds = new Set(
    importedApiRecords.map((match) => String(match.providerMatchId)),
  );
  const allMissing = payload.response.filter(
    (fixture) => !importedIds.has(String(fixture.fixture.id)),
  );
  const missingByCompetition = new Map<string, number>();
  for (const fixture of allMissing)
    missingByCompetition.set(
      `${fixture.league.id}:${fixture.league.name}`,
      (missingByCompetition.get(
        `${fixture.league.id}:${fixture.league.name}`,
      ) ?? 0) + 1,
    );
  const expectedByLeague = new Map<string, number>();
  const storedByLeague = new Map<string, number>();
  const pageByLeague = new Map<string, number>();
  for (const fixture of expected)
    expectedByLeague.set(
      supportedLeagues.get(fixture.league.id)!,
      (expectedByLeague.get(supportedLeagues.get(fixture.league.id)!) ?? 0) + 1,
    );
  for (const match of stored)
    storedByLeague.set(
      String(match.leagueCode),
      (storedByLeague.get(String(match.leagueCode)) ?? 0) + 1,
    );
  for (const match of pageRecords)
    pageByLeague.set(
      String(match.leagueCode),
      (pageByLeague.get(String(match.leagueCode)) ?? 0) + 1,
    );
  const latestRun = await db
    .collection<any>("syncRuns")
    .findOne(
      { provider: "football-api" },
      {
        sort: { startedAt: -1 },
        projection: {
          startedAt: 1,
          finishedAt: 1,
          mode: 1,
          status: 1,
          listRequests: 1,
          detailRequests: 1,
          fixturesUpdated: 1,
          insights: 1,
        },
      },
    );
  const quota = await db
    .collection<any>("footballApiQuota")
    .findOne({ day: date }, { projection: { requests: 1, limit: 1 } });
  console.log(
    JSON.stringify(
      {
        date,
        apiTotal: payload.response.length,
        expectedSupported: expected.length,
        storedToday: stored.length,
        pageLimit: 100,
        pageVisible: pageRecords.length,
        pageOmitted: stored.length - pageRecords.length,
        missingCount: missing.length,
        apiFixturesNotImported: allMissing.length,
        missingByCompetition: Object.fromEntries(missingByCompetition),
        expectedByLeague: Object.fromEntries(expectedByLeague),
        storedByLeague: Object.fromEntries(storedByLeague),
        pageVisibleByLeague: Object.fromEntries(pageByLeague),
        missing: missing.map((fixture) => ({
          id: fixture.fixture.id,
          league: fixture.league.name,
          home: fixture.teams.home.name,
          away: fixture.teams.away.name,
          kickoff: fixture.fixture.date,
        })),
        latestRun,
        quota,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
