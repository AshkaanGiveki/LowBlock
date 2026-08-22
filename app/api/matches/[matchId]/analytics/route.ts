import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isPredictionLocked } from "@/lib/domain/predictionLock";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params; const url = new URL(req.url); const clubId = url.searchParams.get("clubId"); const db = await getDb(); const viewer = await currentUserId();
  const match = await db.collection<any>("matches").findOne({ provider: "football-api", providerMatchId: matchId }); if (!match) return NextResponse.json({ error: "match not found" }, { status: 404 });
  if (clubId) { if (!viewer || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "Club access required" }, { status: 403 }); const membership = await db.collection("clubMemberships").findOne({ clubId, userId: viewer, leftAt: null }); if (!membership) return NextResponse.json({ error: "Club membership required" }, { status: 403 }); }
  const started = ["LIVE", "FINISHED", "SUSPENDED"].includes(String(match.status)) || (match.status === "SCHEDULED" && new Date(match.kickoffAt).getTime() <= Date.now());
  if (!started) return NextResponse.json({ error: "analytics unavailable before kick-off" }, { status: 403 });
  const locked = isPredictionLocked(match); if (!locked && !clubId) return NextResponse.json({ error: "analytics unavailable" }, { status: 403 });
  const predictions = await db.collection<any>("predictions").find({ matchId, userId: { $ne: "guest" } }).toArray(); const scoreRows = await db.collection<any>("predictionScores").find({ matchId }).toArray(); const scoreByUser = new Map(scoreRows.map(score => [score.userId, score]));
  const eligibleUserIds = clubId ? new Set(scoreRows.filter(score => score.clubIdAtLock === clubId).map(score => String(score.userId))) : null; const visiblePredictions = clubId && locked ? predictions.filter(prediction => eligibleUserIds?.has(String(prediction.userId))) : predictions;
  const ids = visiblePredictions.map(prediction => prediction.userId).filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id)); const users = ids.length ? await db.collection<any>("users").find({ _id: { $in: ids } }, { projection: { username: 1, avatarUrl: 1 } }).toArray() : []; const names = new Map(users.map(user => [String(user._id), user]));
  const distribution = new Map<string, number>(); for (const prediction of visiblePredictions) { if (!locked) continue; const key = `${prediction.homeGoals}-${prediction.awayGoals}`; distribution.set(key, (distribution.get(key) ?? 0) + 1); }
  const userRows = visiblePredictions.map(prediction => { const score = scoreByUser.get(prediction.userId); return { username: names.get(prediction.userId)?.username ?? "LowBlock Player", avatarUrl: names.get(prediction.userId)?.avatarUrl ?? null, submitted: true, homeGoals: locked ? prediction.homeGoals : null, awayGoals: locked ? prediction.awayGoals : null, points: locked ? Number(score?.points ?? 0) : null }; });
  return NextResponse.json({ match: { homeTeam: match.homeTeam, awayTeam: match.awayTeam, homeGoals: match.homeGoals, awayGoals: match.awayGoals, leagueCode: match.leagueCode, matchday: match.matchday, status: match.status }, locked, total: visiblePredictions.length, averagePoints: userRows.length ? userRows.reduce((sum, row) => sum + Number(row.points ?? 0), 0) / userRows.length : 0, distribution: [...distribution.entries()].map(([score, count]) => ({ score, count })).sort((a, b) => b.count - a.count), users: userRows });
}
