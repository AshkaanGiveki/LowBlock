import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { getAwardAsset } from "@/lib/awards/config";
import { hashAwardShareToken } from "@/lib/awards/shareToken";
import { currentUserId } from "@/lib/auth/session";
import { SharedPredictionExperience } from "@/components/SharedPredictionExperience";

export const dynamic = "force-dynamic";

async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{6}$/.test(token) && !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const db = await getDb();
  const award = await db.collection<any>("awards").findOne({ shareTokenHash: hashAwardShareToken(token), scope: "LOWBLOCK" });
  if (!award) return null;
  const asset = getAwardAsset(award);
  if (!asset) return null;
  const viewerId = await currentUserId();

  const [winner, membership, scores] = await Promise.all([
    db.collection<any>("users").findOne({ _id: ObjectId.isValid(String(award.userId)) ? new ObjectId(String(award.userId)) : award.userId }, { projection: { username: 1, avatarUrl: 1 } }),
    db.collection<any>("clubMemberships").findOne({ userId: award.userId, leftAt: null }, { sort: { joinedAt: -1 }, projection: { clubId: 1 } }),
    db.collection<any>("predictionScores").aggregate([{ $match: { userId: award.userId, leagueCode: award.competitionId, seasonStartYear: award.seasonStartYear, matchday: award.roundNumber } }, { $group: { _id: null, points: { $sum: "$points" } } }]).toArray(),
  ]);
  const club = membership?.clubId && ObjectId.isValid(String(membership.clubId)) ? await db.collection<any>("clubs").findOne({ _id: new ObjectId(String(membership.clubId)) }, { projection: { name: 1, imageUrl: 1 } }) : null;
  const now = new Date();
  const predictedIds = viewerId ? (await db.collection<any>("predictions").find({ userId: viewerId }, { projection: { matchId: 1 } }).toArray()).map((row) => row.matchId) : [];
  const query = { provider: "football-api", rawApiResponse: { $exists: true }, status: { $nin: ["VOID", "CANCELLED", "POSTPONED"] }, kickoffAt: { $gt: now }, ...(viewerId ? { providerMatchId: { $nin: predictedIds } } : {}) };
  const same = await db.collection<any>("matches").find({ ...query, leagueCode: award.competitionId }).sort({ kickoffAt: 1 }).limit(1).toArray();
  const fallback = same.length ? same : await db.collection<any>("matches").find(query).sort({ kickoffAt: 1 }).limit(1).toArray();
  const match = fallback[0] ?? null;
  const prediction = viewerId && match ? await db.collection<any>("predictions").findOne({ userId: viewerId, matchId: match.providerMatchId }) : null;
  return {
    award: { competitionName: award.competitionName, competitionId: award.competitionId ?? "WEEKLY", seasonStartYear: award.seasonStartYear ?? new Date().getUTCFullYear(), roundNumber: award.roundNumber ?? 0 },
    winner: { name: winner?.username ?? "LowBlock Player", avatarUrl: winner?.avatarUrl ?? null, clubName: club?.name ?? null, clubImageUrl: club?.imageUrl ?? null, points: Number(scores[0]?.points ?? 0) },
    match: match ? { providerMatchId: match.providerMatchId, kickoffAt: new Date(match.kickoffAt).toISOString(), status: match.status, homeTeam: match.homeTeam, awayTeam: match.awayTeam } : null,
    initial: prediction ? { homeGoals: prediction.homeGoals, awayGoals: prediction.awayGoals } : null,
    authenticated: Boolean(viewerId),
    imageUrl: `/api/awards/share/${token}/image`,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> { const { token } = await params; const data = await load(token); return { title: data ? `${data.award.competitionName} Round Winner | LowBlock` : "LowBlock Award", description: "Think you can take the next crown? Make your prediction." }; }
export default async function AwardSharePage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; const data = await load(token); if (!data) notFound(); return <SharedPredictionExperience token={token} {...data} />; }
