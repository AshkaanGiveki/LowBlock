import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { isH2HEnabled } from "@/lib/domain/h2h";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { db } = auth;
  const [users, matches, upcoming, live, finished, predictions, clubs, syncRuns, h2hWeeks, pendingNotifications] = await Promise.all([
    db.collection("users").countDocuments({}),
    db.collection("matches").countDocuments({}),
    db.collection("matches").countDocuments({ kickoffAt: { $gte: new Date() }, status: { $nin: ["CANCELLED", "POSTPONED"] } }),
    db.collection("matches").countDocuments({ status: { $in: ["LIVE", "IN_PLAY", "1H", "2H", "HT"] } }),
    db.collection("matches").countDocuments({ status: { $in: ["FINISHED", "FT", "AET", "PEN"] } }),
    db.collection("predictions").countDocuments({}),
    db.collection("clubs").countDocuments({}),
    db.collection("syncRuns").find({}, { projection: { provider: 1, status: 1, startedAt: 1, finishedAt: 1, matchesUpserted: 1, matchesFetched: 1, error: 1 } }).sort({ startedAt: -1 }).limit(5).toArray(),
    db.collection("h2hWeeks").find({}, { projection: { weekKey: 1, startsAt: 1, endsAt: 1, status: 1, updatedAt: 1 } }).sort({ startsAt: -1 }).limit(5).toArray(),
    db.collection("notificationJobs").countDocuments({ status: { $in: ["PENDING", "FAILED", "PROCESSING"] } }).catch(() => 0),
  ]);
  const scoredPredictions = await db.collection("predictions").countDocuments({ points: { $exists: true } });
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    actor: { username: auth.user.username ?? "Administrator" },
    health: { database: "connected", h2hEnabled: isH2HEnabled(), pendingNotifications },
    counts: { users, matches, upcoming, live, finished, predictions, unscoredPredictions: Math.max(0, predictions - scoredPredictions), clubs },
    syncRuns: syncRuns.map((run) => ({ ...run, _id: String(run._id) })),
    h2hWeeks: h2hWeeks.map((week) => ({ ...week, _id: String(week._id) })),
  }, { headers: { "Cache-Control": "no-store" } });
}
