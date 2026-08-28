import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getDefendingChampionUserId } from "@/lib/awards/defendingChampion";

export async function GET() {
  const userId = await currentUserId();
  if (!userId || !ObjectId.isValid(userId)) return NextResponse.json({ user: null });
  const db = await getDb();
  const [user, championId] = await Promise.all([
    db.collection<{ username: string; avatarUrl?: string | null }>("users").findOne({ _id: new ObjectId(userId) }, { projection: { username: 1, avatarUrl: 1 } }),
    getDefendingChampionUserId(db),
  ]);
  return NextResponse.json({ user: user ? { username: user.username, avatarUrl: user.avatarUrl ?? null, isDefendingChampion: String(user._id) === championId } : null });
}
