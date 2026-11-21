import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/auth/admin";
import { LEAGUES } from "@/lib/football/leagues";

export const dynamic = "force-dynamic";
const limit = 40;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const serialize = (value: any): any => {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "matches";
  const search = url.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const page = Math.max(0, Math.min(249, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0));
  const regex = search ? new RegExp(escapeRegex(search), "i") : null;
  const { db } = auth;
  let rows: any[] = [];
  let total = 0;
  if (section === "matches") {
    const query = regex ? { $or: [{ homeTeamName: regex }, { awayTeamName: regex }, { "homeTeam.name": regex }, { "awayTeam.name": regex }, { tournamentName: regex }, { tournament: regex }, { leagueCode: regex }, { status: regex }] } : {};
    [total, rows] = await Promise.all([db.collection("matches").countDocuments(query), db.collection("matches").find(query, { projection: { providerMatchId: 1, matchId: 1, leagueCode: 1, provider: 1, adminCreated: 1, adminCreatedBy: 1, homeTeamName: 1, awayTeamName: 1, homeTeam: 1, awayTeam: 1, tournamentName: 1, tournament: 1, kickoffAt: 1, status: 1, homeGoals: 1, awayGoals: 1, homeScore: 1, awayScore: 1, score: 1, source: 1, createdAt: 1, updatedAt: 1, predictionsCount: 1, adminHiddenFromListings: 1 } }).sort({ kickoffAt: -1 }).skip(page * limit).limit(limit).toArray()]);
  } else if (section === "users") {
    const query = regex ? { $or: [{ username: regex }, { displayName: regex }] } : {};
    [total, rows] = await Promise.all([db.collection("users").countDocuments(query), db.collection("users").find(query, { projection: { username: 1, displayName: 1, role: 1, isAdmin: 1, createdAt: 1, lastActiveAt: 1, points: 1, globalPoints: 1, platform: 1 } }).sort({ createdAt: -1 }).skip(page * limit).limit(limit).toArray()]);
  } else if (section === "clubs") {
    const query = regex ? { $or: [{ name: regex }, { code: regex }] } : {};
    [total, rows] = await Promise.all([db.collection("clubs").countDocuments(query), db.collection("clubs").find(query, { projection: { name: 1, code: 1, ownerId: 1, state: 1, visibility: 1, discoveryMode: 1, createdAt: 1, tournamentPreferences: 1 } }).sort({ createdAt: -1 }).skip(page * limit).limit(limit).toArray()]);
  } else if (section === "superleague") {
    const query = regex ? { $or: [{ weekKey: regex }, { status: regex }] } : {};
    [total, rows] = await Promise.all([db.collection("h2hWeeks").countDocuments(query), db.collection("h2hWeeks").find(query).sort({ startsAt: -1 }).skip(page * limit).limit(limit).toArray()]);
  } else if (section === "sync") {
    const query = regex ? { $or: [{ provider: regex }, { status: regex }, { error: regex }] } : {};
    [total, rows] = await Promise.all([db.collection("syncRuns").countDocuments(query), db.collection("syncRuns").find(query, { projection: { provider: 1, mode: 1, status: 1, startedAt: 1, finishedAt: 1, matchesFetched: 1, matchesUpserted: 1, requestCount: 1, attempt: 1, error: 1 } }).sort({ startedAt: -1 }).skip(page * limit).limit(limit).toArray()]);
  } else if (section === "tournaments") {
    rows = LEAGUES.filter((item: any) => !regex || regex.test(item.name ?? "") || regex.test(item.faName ?? "") || regex.test(item.code ?? "")).map((item: any) => ({ code: item.code, name: item.name ?? item.enName, faName: item.faName, logo: item.logo, globalLeaderboard: item.globalLeaderboard, h2h: item.h2h, defaultClubLeaderboard: item.defaultClubLeaderboard, providerCompetitionId: item.providerCompetitionId }));
    total = rows.length;
  } else if (section === "awards") {
    [total, rows] = await Promise.all([db.collection("awards").countDocuments({}), db.collection("awards").find({}, { projection: { userId: 1, type: 1, title: 1, createdAt: 1, revealedAt: 1, source: 1, weekKey: 1 } }).sort({ createdAt: -1 }).skip(page * limit).limit(limit).toArray()]);
  } else if (section === "notifications") {
    const query = regex ? { $or: [{ type: regex }, { status: regex }, { jobKey: regex }, { lastError: regex }] } : {};
    [total, rows] = await Promise.all([db.collection("notificationJobs").countDocuments(query), db.collection("notificationJobs").find(query, { projection: { jobKey: 1, type: 1, status: 1, attempts: 1, runAt: 1, createdAt: 1, updatedAt: 1, lastError: 1 } }).sort({ runAt: -1 }).skip(page * limit).limit(limit).toArray()]);
  } else if (section === "teams") {
    const query = regex ? { $or: [{ "names.en": regex }, { "names.fa": regex }, { centralTeamId: regex }] } : {};
    [total, rows] = await Promise.all([db.collection("centralTeams").countDocuments(query), db.collection("centralTeams").find(query, { projection: { centralTeamId: 1, names: 1, logoUrl: 1, isNational: 1, h2hRating: 1, h2hRatingVersion: 1, h2hRatingUpdatedAt: 1 } }).sort({ "names.en": 1 }).skip(page * limit).limit(limit).toArray()]);
  } else if (section === "audit") {
    const query = regex ? { $or: [{ "actor.username": regex }, { action: regex }, { target: regex }, { outcome: regex }] } : {};
    [total, rows] = await Promise.all([db.collection("adminAuditLog").countDocuments(query), db.collection("adminAuditLog").find(query, { projection: { actor: 1, action: 1, target: 1, outcome: 1, createdAt: 1, summary: 1 } }).sort({ createdAt: -1 }).skip(page * limit).limit(limit).toArray()]);
  } else {
    return NextResponse.json({ error: "UNKNOWN_SECTION" }, { status: 400 });
  }
  return NextResponse.json({ section, total, limit, page, rows: serialize(rows) }, { headers: { "Cache-Control": "no-store" } });
}
