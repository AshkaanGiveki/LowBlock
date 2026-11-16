import type { Db } from "mongodb";

export type HistoricalResult = "W" | "D" | "L";
type Fixture = {
  providerMatchId: string;
  provider: string;
  leagueCode?: string;
  seasonStartYear?: number;
  kickoffAt: Date | string;
  status: string;
  homeTeam: { id: number; name: string; logoUrl?: string | null };
  awayTeam: { id: number; name: string; logoUrl?: string | null };
  homeGoals: number | null;
  awayGoals: number | null;
};
export type FormFixture = {
  fixtureId: string;
  date: string;
  opponent: string;
  venue: "home" | "away";
  goalsFor: number;
  goalsAgainst: number;
  result: HistoricalResult;
};
export type H2HFixture = {
  fixtureId: string;
  date: string;
  leagueCode: string | null;
  homeTeam: Fixture["homeTeam"];
  awayTeam: Fixture["awayTeam"];
  homeGoals: number;
  awayGoals: number;
};

function validFixture(row: Fixture): boolean {
  return row?.status === "FINISHED" &&
    Number.isFinite(row.homeGoals) && Number.isFinite(row.awayGoals) &&
    Number.isFinite(new Date(row.kickoffAt).getTime()) &&
    Number.isFinite(Number(row.homeTeam?.id)) &&
    Number.isFinite(Number(row.awayTeam?.id));
}

export function summarizeTeamForm(rows: Fixture[], teamId: number): FormFixture[] {
  return rows.filter(validFixture).slice(0, 5).map((row) => {
    const home = Number(row.homeTeam.id) === teamId;
    const goalsFor = Number(home ? row.homeGoals : row.awayGoals);
    const goalsAgainst = Number(home ? row.awayGoals : row.homeGoals);
    return {
      fixtureId: String(row.providerMatchId),
      date: new Date(row.kickoffAt).toISOString(),
      opponent: home ? row.awayTeam.name : row.homeTeam.name,
      venue: home ? "home" as const : "away" as const,
      goalsFor, goalsAgainst,
      result: goalsFor > goalsAgainst ? "W" as const : goalsFor < goalsAgainst ? "L" as const : "D" as const,
    };
  });
}

export function summarizeH2H(rows: Fixture[]): H2HFixture[] {
  return rows.filter(validFixture).slice(0, 10).map((row) => ({
    fixtureId: String(row.providerMatchId),
    date: new Date(row.kickoffAt).toISOString(),
    leagueCode: row.leagueCode ?? null,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    homeGoals: Number(row.homeGoals),
    awayGoals: Number(row.awayGoals),
  }));
}

/**
 * Bounded, provider-isolated reads from matches already imported by LowBlock.
 * These are NOT complete historical datasets; callers must label coverage
 * as partial unless full league/season ingestion is independently verified.
 */
export async function buildLocalHistory(db: Db, match: Fixture) {
  const homeId = Number(match.homeTeam?.id);
  const awayId = Number(match.awayTeam?.id);
  const cutoff = new Date(match.kickoffAt);
  if (!Number.isFinite(homeId) || !Number.isFinite(awayId) ||
      homeId <= 0 || awayId <= 0 || !Number.isFinite(cutoff.getTime())) {
    return { form: { home: [], away: [] }, h2h: [], coverage: "partial-imported-fixtures" as const };
  }
  const collection = db.collection<Fixture>("matches");
  const base = { provider: match.provider, status: "FINISHED", kickoffAt: { $lt: cutoff } };
  const teamQuery = (id: number) => ({
    ...base,
    $or: [{ "homeTeam.id": id }, { "awayTeam.id": id }],
  });
  const [home, away, meetings] = await Promise.all([
    collection.find(teamQuery(homeId)).sort({ kickoffAt: -1 }).limit(30).toArray(),
    collection.find(teamQuery(awayId)).sort({ kickoffAt: -1 }).limit(30).toArray(),
    collection.find({
      ...base,
      $or: [
        { "homeTeam.id": homeId, "awayTeam.id": awayId },
        { "homeTeam.id": awayId, "awayTeam.id": homeId },
      ],
    }).sort({ kickoffAt: -1 }).limit(30).toArray(),
  ]);
  return {
    form: { home: summarizeTeamForm(home, homeId), away: summarizeTeamForm(away, awayId) },
    h2h: summarizeH2H(meetings),
    coverage: "partial-imported-fixtures" as const,
  };
}

export async function refreshLocalMatchIntelligence(db: Db, now = new Date()) {
  // Only match windows that users are likely to open; avoid full-table reads.
  const matches = await db.collection<Fixture>("matches").find({
    provider: { $in: ["sportsapi", "football-api"] },
    kickoffAt: {
      $gte: new Date(now.getTime() - 18 * 60 * 60_000),
      $lte: new Date(now.getTime() + 48 * 60 * 60_000),
    },
  }).sort({ kickoffAt: 1 }).limit(80).toArray();

  // Official tables are materialized once by the worker and reused for every
  // match in the same competition/season. Never compute standings per viewer.
  const keys = [...new Set(matches.filter((match) => match.leagueCode && match.seasonStartYear)
    .map((match) => match.provider + ":" + match.leagueCode + ":" + match.seasonStartYear))];
  const standings = keys.length ? await db.collection<any>("leagueStandings")
    .find({ _id: { $in: keys }, verified: true, updatedAt: { $gte: new Date(now.getTime() - 48 * 60 * 60_000) } })
    .project({ _id: 1, rows: 1, updatedAt: 1 }).toArray() : [];
  const tableByKey = new Map(standings.map((row) => [row._id, row]));
  // Four at a time bounds the database load even on a busy matchday.
  let updated = 0;
  for (let i = 0; i < matches.length; i += 4) {
    const batch = matches.slice(i, i + 4);
    const items = await Promise.all(batch.map(async (match) => ({
      match,
      local: await buildLocalHistory(db, match),
      table: tableByKey.get(match.provider + ":" + match.leagueCode + ":" + match.seasonStartYear),
    })));
    if (!items.length) continue;
    await db.collection<any>("footballMatchIntelligence").bulkWrite(items.map(({ match, local, table }) => ({
      updateOne: {
        filter: { _id: match.provider + ":" + String(match.providerMatchId) },
        update: {
          $set: {
            local, localUpdatedAt: now, provider: match.provider, matchId: String(match.providerMatchId),
            standingsVerified: Boolean(table),
            ...(table ? { standings: table.rows, standingsUpdatedAt: table.updatedAt } : {}),
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    })), { ordered: false });
    updated += items.length;
  }
  return { updated, providerRequests: 0 };
}
