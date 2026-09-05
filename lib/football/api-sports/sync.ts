import { env } from "@/lib/env";
import { ensureIndexes, getDb } from "@/lib/db/mongo";
import { LEAGUES, isQualityInternationalFriendly } from "@/lib/football/leagues";
import { apiRequest, remainingApiRequests } from "./client";
import { runScoreEngine } from "@/lib/scoring/scoreEngine";
import { rebuildRoundRecords } from "@/lib/football/roundLifecycle";
import { invalidateCompetitionCaches } from "@/lib/domain/cache";
import { syncMatchInsights } from "./matchInsights";

type Fixture = { fixture: { id: number; date: string; status: { short: string; long: string; elapsed: number | null }; venue?: { id: number | null; name: string | null; city: string | null } }; league: { id: number; season?: number; round: string | null }; teams: { home: { id: number; name: string; logo: string | null }; away: { id: number; name: string; logo: string | null } }; goals: { home: number | null; away: number | null }; score: unknown };

function hasValidFixtureDate(f: Fixture) { return Number.isFinite(new Date(f.fixture.date).getTime()); }
function normalized(f: Fixture, leagueCode: string) {
  const year = f.league.season ?? new Date(f.fixture.date).getUTCFullYear();
  const round = String(f.league.round ?? "");
  const numericRound = round.match(/(\d+)$/)?.[1];
  const matchday = numericRound ? Number(numericRound) : /round of 16/i.test(round) ? 100 : /quarter[- ]final/i.test(round) ? 101 : /semi[- ]final/i.test(round) ? 102 : /final/i.test(round) ? 103 : 0;
  const status = /FT|AET|PEN/.test(f.fixture.status.short) ? "FINISHED" : /^PST$/.test(f.fixture.status.short) ? "POSTPONED" : /^SUSP$/.test(f.fixture.status.short) ? "SUSPENDED" : /CANC|ABD/.test(f.fixture.status.short) ? "VOID" : /LIVE|1H|2H|HT|ET|BT|P/.test(f.fixture.status.short) ? "LIVE" : "SCHEDULED";
  return { provider: "football-api", providerMatchId: String(f.fixture.id), leagueCode, seasonStartYear: year, matchday, providerRound: round, roundId: `${leagueCode}:${year}:${matchday}`, homeTeamProviderId: String(f.teams.home.id), awayTeamProviderId: String(f.teams.away.id), homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logoUrl: f.teams.home.logo }, awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logoUrl: f.teams.away.logo }, kickoffAt: new Date(f.fixture.date), status, elapsed: f.fixture.status.elapsed ?? null, homeGoals: f.goals.home, awayGoals: f.goals.away, venue: f.fixture.venue ?? null };
}

async function saveFixtures(db: Awaited<ReturnType<typeof getDb>>, leagueCode: string, fixtures: Fixture[], detail = false) {
  const validFixtures = fixtures.filter((f) => { const valid = hasValidFixtureDate(f); if (!valid) console.error("football_fixture_invalid_date", { leagueCode, fixtureId: f.fixture?.id, date: f.fixture?.date }); return valid; });
  const ops = validFixtures.map((f) => ({ updateOne: { filter: { provider: "football-api", providerMatchId: String(f.fixture.id) }, update: { $set: { ...normalized(f, leagueCode), rawApiResponse: f, apiDataType: detail ? "fixture-detail" : "current-window", ...(detail ? { detailsUpdatedAt: new Date() } : {}), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, upsert: true } }));
  if (ops.length) await db.collection("matches").bulkWrite(ops, { ordered: false });
  const teams = fixtures.flatMap((f) => [f.teams.home, f.teams.away]).filter((team, index, array) => array.findIndex((item) => item.id === team.id) === index).map((team) => ({ updateOne: { filter: { provider: "football-api", providerTeamId: String(team.id) }, update: { $set: { provider: "football-api", providerTeamId: String(team.id), sourceName: team.name, crestUrl: team.logo, currentLeagueCodes: [leagueCode], updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, upsert: true } }));
  if (teams.length) await db.collection("teams").bulkWrite(teams, { ordered: false });
  return ops.length;
}

async function saveDailyFixtures(dateKey: string, db: Awaited<ReturnType<typeof getDb>>) {
  const result = await apiRequest<Fixture>({ date: dateKey, timezone: "UTC" });
  const byLeague = new Map<string, Map<number, Fixture>>();
  for (const league of LEAGUES) byLeague.set(league.code, new Map());
  for (const fixture of result.response) { const league = LEAGUES.find((item) => item.apiLeagueId === fixture.league.id); if (!league || (league.code === "FRIENDLY" && !isQualityInternationalFriendly(fixture.teams.home.name, fixture.teams.away.name))) continue; byLeague.get(league.code)?.set(fixture.fixture.id, fixture); }
  let total = 0;
  for (const league of LEAGUES) { const fixtures = [...(byLeague.get(league.code)?.values() ?? [])]; total += await saveFixtures(db, league.code, fixtures); const season = fixtures.find((fixture) => fixture.league.season)?.league.season; await db.collection("leagues").updateOne({ code: league.code }, { $set: { ...league, seasonStartYear: season ?? new Date().getUTCFullYear(), provider: "football-api", health: "OK", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true }); }
  return { total, listRequests: 1 };
}

export async function syncFootballApiDate(dateKey: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("INVALID_UTC_DATE"); const db = await getDb(); await ensureIndexes(); const result = await saveDailyFixtures(dateKey, db); const scoreEngine = await runScoreEngine(); invalidateCompetitionCaches(); return { ...result, scoreEngine }; }

export async function syncFootballApi() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const db = await getDb(); await ensureIndexes(); const startedAt = new Date(); let listRequests = 0, detailRequests = 0, total = 0;
  const byLeague = new Map<string, Map<number, Fixture>>(); for (const league of LEAGUES) byLeague.set(league.code, new Map());
  if (env.FOOTBALL_API_MODE === "season") { for (const league of LEAGUES) { const result = await apiRequest<Fixture>({ league: String(league.apiLeagueId), season: String(env.FOOTBALL_API_SEASON ?? new Date().getUTCFullYear()), timezone: "UTC" }); listRequests++; for (const fixture of result.response) if (league.code !== "FRIENDLY" || isQualityInternationalFriendly(fixture.teams.home.name, fixture.teams.away.name)) byLeague.get(league.code)?.set(fixture.fixture.id, fixture); } }
  else { const date = new Date().toISOString().slice(0, 10); const result = await apiRequest<Fixture>({ date, timezone: "UTC" }); listRequests++; for (const fixture of result.response) { const league = LEAGUES.find((item) => item.apiLeagueId === fixture.league.id); if (!league || (league.code === "FRIENDLY" && !isQualityInternationalFriendly(fixture.teams.home.name, fixture.teams.away.name))) continue; byLeague.get(league.code)?.set(fixture.fixture.id, fixture); } }
  const allCurrent: Fixture[] = [];
  for (const league of LEAGUES) { const fixtures = [...(byLeague.get(league.code)?.values() ?? [])]; allCurrent.push(...fixtures.filter(hasValidFixtureDate)); total += await saveFixtures(db, league.code, fixtures); const season = fixtures.find((fixture) => fixture.league.season)?.league.season; await db.collection("leagues").updateOne({ code: league.code }, { $set: { ...league, seasonStartYear: season ?? new Date().getUTCFullYear(), provider: "football-api", health: "OK", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true }); }
  const now = Date.now(); const candidates = allCurrent.filter((fixture) => { const time = new Date(fixture.fixture.date).getTime(); return time >= now - 864e5 && time <= now + 864e5; }).map((fixture) => String(fixture.fixture.id)); const maxDetails = Math.min(await remainingApiRequests(), 95); const size = env.FOOTBALL_API_DETAIL_BATCH_SIZE;
  if (env.FOOTBALL_API_MODE === "season") for (let i = 0; i < Math.min(candidates.length, maxDetails * size); i += size) { const ids = candidates.slice(i, i + size); const result = await apiRequest<Fixture>({ ids: ids.join("-"), timezone: "UTC" }); detailRequests++; for (const fixture of result.response) { const league = LEAGUES.find((item) => item.apiLeagueId === fixture.league.id); if (league) total += await saveFixtures(db, league.code, [fixture], true); } }
  const insights = await syncMatchInsights(db); const rounds = await rebuildRoundRecords(db); await db.collection("syncRuns").insertOne({ provider: "football-api", mode: env.FOOTBALL_API_MODE, startedAt, finishedAt: new Date(), status: "OK", listRequests, detailRequests, fixturesUpdated: total, roundsUpdated: rounds, insights }); const scoreEngine = await runScoreEngine(); invalidateCompetitionCaches(); console.log(`Football API sync complete: ${total} fixtures, ${listRequests + detailRequests + insights.h2hRequests} provider requests; ${rounds} rounds; ${insights.snapshots} insight snapshots; score engine: ${scoreEngine.scores} scores`); return { total, listRequests, detailRequests, rounds, insights, scoreEngine };
}
