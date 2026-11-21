import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const serialize = (value: any): any => {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
};

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { matchId } = await params;
  const match = await auth.db.collection<any>("matches").findOne({ providerMatchId: matchId });
  if (!match) return NextResponse.json({ error: "RECORD_NOT_FOUND" }, { status: 404 });
  const predictions = await auth.db.collection<any>("predictions").find({ matchId }, { projection: { userId: 1, homeGoals: 1, awayGoals: 1, points: 1, exact: 1, correctOutcome: 1, createdAt: 1, updatedAt: 1 } }).sort({ points: -1, createdAt: 1 }).toArray();
  const ids = predictions.map((prediction) => String(prediction.userId)).filter((id) => ObjectId.isValid(id));
  const users = await auth.db.collection<any>("users").find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { username: 1, displayName: 1, avatarUrl: 1 } }).toArray();
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  return NextResponse.json({ match: serialize(match), predictions: serialize(predictions.map((prediction) => ({ ...prediction, user: userMap.get(String(prediction.userId)) ?? null }))) }, { headers: { "Cache-Control": "no-store" } });
}
