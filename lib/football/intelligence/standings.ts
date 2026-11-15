import type { Db } from "mongodb";
import { COMPETITION_MAPPINGS } from "@/lib/football/competitionMapping";
import { fetchSportsApi } from "@/lib/football/sportsapi/rest";

export type VerifiedStandingRow = {
  rank: number;
  team: { id: number; name: string; logoUrl: string | null };
  played: number;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  points: number;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;
};

/**
 * The provider advertises /api/tournament/:tid/season/:sid/standings.
 * Schema is still account- and competition-dependent. Fail closed unless
 * rows are coherent; never invent table values or mark guesses as verified.
 */
export function parseProviderStandings(response: unknown): VerifiedStandingRow[] | null {
  if (!response || typeof response !== "object") return null;
  const envelope = response as any;
  if (envelope.success === false || envelope.error) return null;
  const root = envelope.data ?? envelope;
  const candidates = root?.standings ?? root?.data?.standings ?? root?.rows ?? root;
  const groups = Array.isArray(candidates) ? candidates : candidates?.rows;
  if (!Array.isArray(groups)) return null;
  const rows = groups.every((row: any) => row?.team)
    ? groups
    : (groups.find((group: any) => group?.type === "total" || group?.type === "overall") ?? groups[0])?.rows;
  if (!Array.isArray(rows) || rows.length < 4) return null;
  const normalized: VerifiedStandingRow[] = [];
  for (const row of rows) {
    const rank = Number(row.position ?? row.rank);
    const id = Number(row.team?.id);
    const points = Number(row.points);
    const played = Number(row.matchesPlayed ?? row.played ?? row.all?.played);
    const name = row.team?.name;
    if (!Number.isInteger(rank) || rank < 1 || !Number.isInteger(id) || id < 1 ||
        !Number.isFinite(points) || !Number.isInteger(played) || played < 0 ||
        typeof name !== "string" || !name.trim()) return null;
    const nullable = (value: unknown): number | null =>
      value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
    normalized.push({
      rank, team: { id, name, logoUrl: row.team.logoUrl ?? row.team.logo ?? null },
      played, points,
      wins: nullable(row.wins ?? row.all?.win),
      draws: nullable(row.draws ?? row.all?.draw),
      losses: nullable(row.losses ?? row.all?.lose),
      goalsFor: nullable(row.scoresFor ?? row.goalsFor ?? row.goals?.for),
      goalsAgainst: nullable(row.scoresAgainst ?? row.goalsAgainst ?? row.goals?.against),
      goalDifference: nullable(row.scoreDifference ?? row.goalDifference),
    });
  }
  if (new Set(normalized.map((row) => row.team.id)).size !== normalized.length ||
      new Set(normalized.map((row) => row.rank)).size !== normalized.length) return null;
  return normalized.sort((a, b) => a.rank - b.rank);
}

/**
 * Worker-only daily staging opt-in, at most THREE standings REST lookups
 * before the shared 60/day atomic reservation boundary. No browser calls.
 * This stays disabled until the account's actual response is validated.
 */
export async function syncVerifiedSportsApiStandings(db: Db, now = new Date()) {
  if (process.env.SPORTSAPI_STANDINGS_SYNC_ENABLED !== "true") {
    return { enabled: false, requests: 0, updated: 0 };
  }
  const today = now.toISOString().slice(0, 10);
  const upcoming = await db.collection<any>("matches").find(
    {
      provider: "sportsapi",
      kickoffAt: { $gte: new Date(now.getTime() - 6 * 60 * 60_000), $lte: new Date(now.getTime() + 24 * 60 * 60_000) },
    },
    { projection: { leagueCode: 1, seasonStartYear: 1 } },
  ).limit(100).toArray();
  const eligible = new Set(["GB1", "ES1", "L1", "IT1", "FR1"]);
  const byLeague = new Map<string, number>();
  for (const match of upcoming) {
    if (eligible.has(match.leagueCode) && Number.isInteger(match.seasonStartYear)) {
      byLeague.set(match.leagueCode, match.seasonStartYear);
    }
  }
  let requests = 0;
  let updated = 0;
  const runs = db.collection<any>("standingsSyncRuns");
  for (const [leagueCode, seasonYear] of [...byLeague].slice(0, 3)) {
    const mapping = COMPETITION_MAPPINGS.find((entry) => entry.code === leagueCode);
    if (!mapping) continue;
    const season = await db.collection<any>("sportsApiSeasons").findOne({ tournamentId: mapping.sportsApiUniqueTournamentId });
    const seasonStart = Number(String(season?.year ?? "").split("/")[0]);
    if (!season?.id || (seasonStart !== seasonYear && seasonStart !== seasonYear % 100)) continue;
    const dailyKey = today + ":" + leagueCode;
    // One attempt per league/day even if the provider times out.
    const reservation = await runs.updateOne(
      { _id: dailyKey },
      { $setOnInsert: { createdAt: now, leagueCode, day: today, status: "RESERVED" } },
      { upsert: true },
    );
    if (!reservation.upsertedCount) continue;
    requests++;
    const response = await fetchSportsApi<any>(
      "/api/tournament/" + mapping.sportsApiUniqueTournamentId + "/season/" + season.id + "/standings",
    );
    const rows = parseProviderStandings(response);
    if (!rows) {
      await runs.updateOne({ _id: dailyKey }, { $set: { status: "UNVERIFIED", finishedAt: new Date() } });
      continue;
    }
    await db.collection("leagueStandings").updateOne(
      { _id: "sportsapi:" + leagueCode + ":" + seasonYear },
      { $set: { rows, verified: true, provider: "sportsapi", leagueCode, seasonStartYear: seasonYear, source: "sportsapi-official", updatedAt: new Date() } },
      { upsert: true },
    );
    await runs.updateOne({ _id: dailyKey }, { $set: { status: "OK", rows: rows.length, finishedAt: new Date() } });
    updated++;
  }
  return { enabled: true, requests, updated };
}
