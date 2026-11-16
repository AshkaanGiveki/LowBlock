import type { Db } from "mongodb";
import { env } from "@/lib/env";
import { fetchSportsApi } from "@/lib/football/sportsapi/rest";
import type { FormFixture } from "./history";

type Result = "W" | "D" | "L";
export type ProviderForm = { results: Result[]; position: number | null };
export type ProviderDuel = { homeWins: number; draws: number; awayWins: number };
export type ProviderHistory = {
  source: "sportsapi";
  updatedAt: Date;
  form?: {
    home: { fixtures: FormFixture[]; results: Result[]; position: number | null };
    away: { fixtures: FormFixture[]; results: Result[]; position: number | null };
  };
  duel?: ProviderDuel;
};

function payload(value: any): any | null {
  if (!value || typeof value !== "object" || value.success === false || value.error) return null;
  return value.data && typeof value.data === "object" ? value.data : value;
}

function nonnegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function parseSportsApiPregameForm(response: unknown): { home: ProviderForm; away: ProviderForm } | null {
  const data = payload(response);
  const read = (side: any): ProviderForm | null => {
    if (!side || !Array.isArray(side.form)) return null;
    const results = side.form.filter((x: unknown): x is Result => x === "W" || x === "D" || x === "L").slice(-5);
    if (!results.length) return null;
    return { results, position: nonnegativeInt(side.position) };
  };
  const home = read(data?.homeTeam);
  const away = read(data?.awayTeam);
  return home && away ? { home, away } : null;
}

/** Match-specific H2H returns aggregate counts, NOT a list of meetings. */
export function parseSportsApiDuel(response: unknown): ProviderDuel | null {
  const duel = payload(response)?.teamDuel;
  if (!duel) return null;
  const homeWins = nonnegativeInt(duel.homeWins);
  const awayWins = nonnegativeInt(duel.awayWins);
  const draws = nonnegativeInt(duel.draws);
  return homeWins === null || awayWins === null || draws === null
    ? null : { homeWins, awayWins, draws };
}

/** Verify team IDs, final scores, and cutoff. Never attach another team's results. */
export function parseSportsApiTeamLast(response: unknown, teamId: number, cutoff: Date): FormFixture[] {
  const data = payload(response);
  const events = Array.isArray(data?.events) ? data.events : [];
  const output: FormFixture[] = [];
  for (const event of events) {
    const id = event?.id ?? event?.eventId;
    const start = typeof event?.startTimestamp === "number"
      ? new Date(event.startTimestamp * 1000) : new Date(event?.startDate ?? NaN);
    const status = String(event?.status?.type ?? "").toLowerCase();
    const code = event?.status?.code;
    if (!id || (status !== "finished" && code !== 100) ||
      !Number.isFinite(start.getTime()) || start >= cutoff) continue;
    const homeId = Number(event?.homeTeam?.id);
    const awayId = Number(event?.awayTeam?.id);
    const home = homeId === teamId && awayId !== teamId;
    const away = awayId === teamId && homeId !== teamId;
    const goalsHome = event?.homeScore?.current;
    const goalsAway = event?.awayScore?.current;
    if ((!home && !away) || !Number.isInteger(goalsHome) || !Number.isInteger(goalsAway) ||
      goalsHome < 0 || goalsAway < 0) continue;
    const goalsFor = home ? goalsHome : goalsAway;
    const goalsAgainst = home ? goalsAway : goalsHome;
    const opponent = home ? event?.awayTeam?.name : event?.homeTeam?.name;
    if (typeof opponent !== "string" || !opponent.trim()) continue;
    output.push({
      fixtureId: String(id), date: start.toISOString(), opponent,
      venue: home ? "home" : "away", goalsFor, goalsAgainst,
      result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
    });
  }
  return output.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}

function validMatch(match: any): boolean {
  return match?.provider === "sportsapi" &&
    /^[0-9]{1,20}$/.test(String(match?.providerMatchId ?? "")) &&
    Number.isInteger(Number(match?.homeTeam?.id)) && Number(match.homeTeam.id) > 0 &&
    Number.isInteger(Number(match?.awayTeam?.id)) && Number(match.awayTeam.id) > 0 &&
    Number.isFinite(new Date(match.kickoffAt).getTime());
}

/**
 * Dedicated worker only. Never called from the browser or read API.
 * Max 18 extra SportsAPI history attempts/day, inside the existing global
 * Mongo-atomic 60/100 request ceiling. Failed attempts still count.
 * Match H2H and pregame-form are pre-kickoff ONLY; team history works later.
 */
export async function syncSportsApiProviderHistory(db: Db, now = new Date()) {
  if (process.env.SPORTSAPI_HISTORY_SYNC_ENABLED !== "true" ||
      !env.SPORTSAPI_API_KEY || process.env.NEXT_PUBLIC_LOWBLOCK_PREVIEW === "true") {
    return { enabled: false, attempts: 0, updated: 0 };
  }
  const today = now.toISOString().slice(0, 10);
  const historyBudget = db.collection<any>("sportsApiHistoryBudget");
  await historyBudget.updateOne({ _id: today }, { $setOnInsert: { used: 0, createdAt: now } }, { upsert: true });
  const reserve = async () => {
    const booked = await historyBudget.findOneAndUpdate(
      { _id: today, used: { $lt: 18 } }, { $inc: { used: 1 } }, { returnDocument: "after" },
    );
    return Boolean(booked);
  };
  let attempts = 0;
  let updated = 0;
  const request = async (path: string): Promise<any | null> => {
    if (!(await reserve())) return null;
    attempts++;
    const result = await fetchSportsApi<any>(path);
    return result.success === false || result.error ? null : result;
  };
  const matches = await db.collection<any>("matches").find({
    provider: "sportsapi",
    kickoffAt: { $gte: new Date(now.getTime() - 5 * 60 * 60_000), $lte: new Date(now.getTime() + 48 * 60 * 60_000) },
    status: { $in: ["SCHEDULED", "LIVE", "IN_PLAY", "PAUSED", "SUSPENDED"] },
  }, { projection: { provider: 1, providerMatchId: 1, kickoffAt: 1, status: 1, homeTeam: 1, awayTeam: 1 } })
    .sort({ kickoffAt: 1 }).limit(8).toArray();
  const teamCache = db.collection<any>("sportsApiTeamHistory");
  for (const match of matches) {
    if (!validMatch(match)) continue;
    const matchId = String(match.providerMatchId);
    const kickoff = new Date(match.kickoffAt);
    const beforeKickoff = now < kickoff && match.status === "SCHEDULED";
    const key = "sportsapi:" + matchId;
    const insights = db.collection<any>("footballMatchIntelligence");
    const existing = await insights.findOne({ _id: key }, { projection: { providerHistory: 1 } });
    const old = existing?.providerHistory as ProviderHistory | undefined;
    const form = old?.form ?? {
      home: { fixtures: [], results: [], position: null },
      away: { fixtures: [], results: [], position: null },
    };
    let duel = old?.duel;
    let touched = false;

    // Each team's historical results are cached once and reused across fixtures.
    for (const side of ["home", "away"] as const) {
      const teamId = Number(match[side + "Team"].id);
      const cacheKey = "sportsapi:" + teamId;
      let saved = await teamCache.findOne({ _id: cacheKey });
      if (!saved || new Date(saved.expiresAt ?? 0) <= now) {
        const response = await request("/api/teams/" + teamId + "/events/last/0");
        if (response) {
          const fixtures = parseSportsApiTeamLast(response, teamId, kickoff);
          await teamCache.updateOne({ _id: cacheKey }, {
            $set: { fixtures, expiresAt: new Date(now.getTime() + 24 * 60 * 60_000), updatedAt: now },
          }, { upsert: true });
          saved = { fixtures };
        }
      }
      if (saved?.fixtures?.length) {
        // Cached list can contain games after THIS fixture, so cutoff again.
        const safe = (saved.fixtures as FormFixture[]).filter((f) => new Date(f.date) < kickoff).slice(0, 5);
        if (safe.length) { form[side].fixtures = safe; touched = true; }
      }
    }
    if (beforeKickoff && !old?.form?.home?.results?.length) {
      const response = await request("/api/match/" + matchId + "/pregame-form");
      const parsed = parseSportsApiPregameForm(response);
      if (parsed) {
        form.home.results = parsed.home.results;
        form.away.results = parsed.away.results;
        form.home.position = parsed.home.position;
        form.away.position = parsed.away.position;
        touched = true;
      }
    }
    if (beforeKickoff && !duel) {
      const response = await request("/api/match/" + matchId + "/h2h");
      const parsed = parseSportsApiDuel(response);
      if (parsed) { duel = parsed; touched = true; }
    }
    if (touched) {
      const providerHistory: ProviderHistory = {
        source: "sportsapi", updatedAt: now, form,
        ...(duel ? { duel } : {}),
      };
      await insights.updateOne({ _id: key }, {
        $set: { provider: "sportsapi", matchId, providerHistory },
        $setOnInsert: { createdAt: now },
      }, { upsert: true });
      updated++;
    }
  }
  return { enabled: true, attempts, updated };
}
