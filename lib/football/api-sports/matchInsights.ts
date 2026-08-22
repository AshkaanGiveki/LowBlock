import type { Db } from "mongodb";
import { apiRequest, remainingApiRequests } from "./client";

type ProviderFixture = { fixture: { id: number; date: string; status: { short: string } }; league?: { name?: string | null }; teams: { home: { id: number; name: string; logo: string | null }; away: { id: number; name: string; logo: string | null } }; goals: { home: number | null; away: number | null } };
type Result = { fixtureId: string; date: string; opponent: { id: number; name: string; logoUrl: string | null }; home: boolean; teamGoals: number; opponentGoals: number; outcome: "W" | "D" | "L"; league: string };
const finished = (item: any) => ["FINISHED", "FT", "AET", "PEN"].includes(String(item.status?.short ?? item.status));

function result(item: any, teamId: number): Result | null { if (!finished(item) || item.homeGoals == null || item.awayGoals == null) return null; const home = Number(item.homeTeamProviderId ?? item.homeTeam?.id) === teamId; const teamGoals = home ? Number(item.homeGoals) : Number(item.awayGoals); const opponentGoals = home ? Number(item.awayGoals) : Number(item.homeGoals); return { fixtureId: String(item.providerMatchId ?? item.fixture?.id), date: new Date(item.kickoffAt ?? item.fixture?.date).toISOString(), opponent: home ? { id: Number(item.awayTeamProviderId ?? item.awayTeam?.id), name: item.awayTeam?.name ?? "", logoUrl: item.awayTeam?.logoUrl ?? item.awayTeam?.logo ?? null } : { id: Number(item.homeTeamProviderId ?? item.homeTeam?.id), name: item.homeTeam?.name ?? "", logoUrl: item.homeTeam?.logoUrl ?? item.homeTeam?.logo ?? null }, home, teamGoals, opponentGoals, outcome: teamGoals > opponentGoals ? "W" : teamGoals === opponentGoals ? "D" : "L", league: item.league?.name ?? item.leagueCode ?? "" }; }

async function localForm(db: Db, teamId: number) { const matches = await db.collection<any>("matches").find({ $or: [{ homeTeamProviderId: String(teamId) }, { awayTeamProviderId: String(teamId) }], status: "FINISHED", kickoffAt: { $lt: new Date() } }).sort({ kickoffAt: -1 }).limit(5).toArray(); return matches.map((match) => result(match, teamId)).filter(Boolean) as Result[]; }

export async function syncMatchInsights(db: Db) {
  const now = new Date(); const horizon = new Date(now.getTime() + 7 * 86400000);
  const upcoming = await db.collection<any>("matches").find({ status: "SCHEDULED", kickoffAt: { $gte: now, $lte: horizon } }, { projection: { providerMatchId: 1, homeTeamProviderId: 1, awayTeamProviderId: 1, homeTeam: 1, awayTeam: 1 } }).toArray();
  const pairs = [...new Map(upcoming.map((match) => { const ids = [Number(match.homeTeamProviderId), Number(match.awayTeamProviderId)].sort((a, b) => a - b); return [`${ids[0]}-${ids[1]}`, { key: `${ids[0]}-${ids[1]}`, homeId: Number(match.homeTeamProviderId), awayId: Number(match.awayTeamProviderId) }]; })).values()];
  let h2hRequests = 0; let attempts = 0; const quota = await remainingApiRequests();
  for (const pair of pairs) {
    const cached = await db.collection<any>("h2hInsights").findOne({ pairKey: pair.key });
    if (cached?.updatedAt && now.getTime() - new Date(cached.updatedAt).getTime() < 24 * 60 * 60 * 1000) continue;
    if (attempts >= quota) break;
    attempts++;
    try {
      const response = await apiRequest<ProviderFixture>({ h2h: pair.key, last: "5" }, "fixtures/headtohead");
      const meetings = response.response.filter((item) => ["FT", "AET", "PEN"].includes(item.fixture.status.short) && item.goals.home != null && item.goals.away != null).map((item) => ({ fixtureId: String(item.fixture.id), date: new Date(item.fixture.date).toISOString(), homeTeam: { id: item.teams.home.id, name: item.teams.home.name, logoUrl: item.teams.home.logo }, awayTeam: { id: item.teams.away.id, name: item.teams.away.name, logoUrl: item.teams.away.logo }, homeGoals: item.goals.home, awayGoals: item.goals.away, league: item.league?.name ?? "" }));
      await db.collection("h2hInsights").updateOne({ pairKey: pair.key }, { $set: { pairKey: pair.key, meetings, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); h2hRequests++;
    } catch { /* A failed optional insight must never fail the football sync. */ }
  }
  let snapshots = 0;
  for (const match of upcoming) {
    const homeId = Number(match.homeTeamProviderId); const awayId = Number(match.awayTeamProviderId); const ids = [homeId, awayId].sort((a, b) => a - b); const h2h = await db.collection<any>("h2hInsights").findOne({ pairKey: `${ids[0]}-${ids[1]}` });
    await db.collection("matchInsights").updateOne({ matchId: String(match.providerMatchId) }, { $set: { matchId: String(match.providerMatchId), home: { id: homeId, name: match.homeTeam.name, logoUrl: match.homeTeam.logoUrl, form: await localForm(db, homeId) }, away: { id: awayId, name: match.awayTeam.name, logoUrl: match.awayTeam.logoUrl, form: await localForm(db, awayId) }, h2h: h2h?.meetings ?? [], updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); snapshots++;
  }
  return { h2hRequests, snapshots };
}
