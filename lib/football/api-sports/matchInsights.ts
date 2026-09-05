import type { Db } from "mongodb";
import { apiRequest, remainingApiRequests } from "./client";
import { isH2HCompetition } from "@/lib/football/leagues";

type ProviderFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league?: { id?: number; name?: string | null; season?: number };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
};

type ProviderStanding = {
  rank: number;
  team: { id: number; name: string; logo: string | null };
  points: number;
  form?: string | null;
  description?: string | null;
  all?: { played: number; win: number; draw: number; lose: number };
  goals?: { for: number; against: number };
};

type InsightOptions = { force?: boolean };
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const finished = (status: string) => ["FT", "AET", "PEN"].includes(status);

function normalizeStanding(row: ProviderStanding) {
  return {
    rank: Number(row.rank),
    team: { id: Number(row.team.id), name: row.team.name, logoUrl: row.team.logo ?? null },
    points: Number(row.points ?? 0),
    form: String(row.form ?? "").replace(/[^WDL]/gi, "").toUpperCase().slice(-5),
    description: row.description ?? null,
    played: Number(row.all?.played ?? 0),
    wins: Number(row.all?.win ?? 0),
    draws: Number(row.all?.draw ?? 0),
    losses: Number(row.all?.lose ?? 0),
    goalsFor: Number(row.goals?.for ?? 0),
    goalsAgainst: Number(row.goals?.against ?? 0),
    goalDifference: Number(row.goals?.for ?? 0) - Number(row.goals?.against ?? 0),
  };
}

function normalizeH2H(item: ProviderFixture) {
  const kickoff = new Date(item.fixture.date);
  return {
    fixtureId: String(item.fixture.id),
    date: kickoff.toISOString(),
    homeTeam: { id: item.teams.home.id, name: item.teams.home.name, logoUrl: item.teams.home.logo },
    awayTeam: { id: item.teams.away.id, name: item.teams.away.name, logoUrl: item.teams.away.logo },
    homeGoals: item.goals.home,
    awayGoals: item.goals.away,
    league: item.league?.name ?? "",
  };
}

export async function syncMatchInsights(db: Db, options: InsightOptions = {}) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const force = options.force === true;
  const upcomingRows = await db.collection<any>("matches").find(
    { status: "SCHEDULED", kickoffAt: { $gte: now, $lte: horizon } },
    { projection: { providerMatchId: 1, leagueCode: 1, seasonStartYear: 1, homeTeamProviderId: 1, awayTeamProviderId: 1, homeTeam: 1, awayTeam: 1 } },
  ).sort({ kickoffAt: 1 }).toArray();
  const today = dayKey(now);
  const upcoming = upcomingRows.filter((match) => { const kickoff = new Date(match.kickoffAt); return Number.isFinite(kickoff.getTime()) && dayKey(kickoff) === today; });

  let h2hRequests = 0;
  let providerRequests = 0;
  const providerErrors: string[] = [];
  let lastProviderRequestAt = 0;
  const throttleProvider = async () => {
    const wait = Math.max(0, 6200 - (Date.now() - lastProviderRequestAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastProviderRequestAt = Date.now();
  };
  const available = await remainingApiRequests();

  const pairs = [...new Map(upcoming.map((match) => {
    const ids = [Number(match.homeTeamProviderId), Number(match.awayTeamProviderId)].sort((a, b) => a - b);
    return [`${ids[0]}-${ids[1]}`, `${ids[0]}-${ids[1]}`];
  })).values()];

  for (const pairKey of pairs) {
    const match = upcoming.find((candidate) => {
      const ids = [Number(candidate.homeTeamProviderId), Number(candidate.awayTeamProviderId)].sort((a, b) => a - b);
      return `${ids[0]}-${ids[1]}` === pairKey;
    });
    if (!match || !isH2HCompetition(match.leagueCode)) continue;
    const cached = await db.collection<any>("h2hInsights").findOne({ pairKey });
    const fresh = cached?.updatedAt && now.getTime() - new Date(cached.updatedAt).getTime() < 24 * 60 * 60 * 1000;
    if (!force && fresh) continue;
    if (providerRequests >= available) break;
    try {
      await throttleProvider();
      const response = await apiRequest<ProviderFixture>({ h2h: pairKey }, "fixtures/headtohead");
      const meetings = response.response
        .filter((item) => finished(item.fixture.status.short) && item.goals.home != null && item.goals.away != null && Number.isFinite(new Date(item.fixture.date).getTime()))
        .sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime())
        .slice(0, 5)
        .map(normalizeH2H);
      await db.collection("h2hInsights").updateOne(
        { pairKey },
        { $set: { pairKey, meetings, provider: "football-api", fetchedAt: now, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      h2hRequests++;
      providerRequests++;
    } catch (error) {
      providerRequests++;
      providerErrors.push(`h2h:${pairKey}:${error instanceof Error ? error.message : "request failed"}`);
      // Insights are optional. Preserve a previous snapshot when the provider fails.
    }
  }

  let snapshots = 0;
  for (const match of upcoming) {
    const homeId = Number(match.homeTeamProviderId);
    const awayId = Number(match.awayTeamProviderId);
    const ids = [homeId, awayId].sort((a, b) => a - b);
    const h2h = isH2HCompetition(match.leagueCode) ? await db.collection<any>("h2hInsights").findOne({ pairKey: `${ids[0]}-${ids[1]}` }) : null;
    await db.collection("matchInsights").updateOne(
      { matchId: String(match.providerMatchId) },
      {
        $set: {
          matchId: String(match.providerMatchId),
          provider: "football-api",
          fetchedAt: now,
          home: { id: homeId, name: match.homeTeam.name, logoUrl: match.homeTeam.logoUrl, form: "", standing: null },
          away: { id: awayId, name: match.awayTeam.name, logoUrl: match.awayTeam.logoUrl, form: "", standing: null },
          standings: [],
          h2h: h2h?.meetings ?? [],
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    snapshots++;
  }

  return { providerRequests, h2hRequests, standingsRequests: 0, snapshots, availableAtStart: available, matches: upcoming.length, providerErrors };
}
