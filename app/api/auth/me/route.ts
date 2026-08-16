import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";

export async function GET() {
  const userId = await currentUserId();
  if (!userId || !ObjectId.isValid(userId)) return NextResponse.json({ user: null });
  const user = await getDb().then((db) => db.collection<{ username: string; avatarUrl?: string | null }>("users").findOne({ _id: new ObjectId(userId) }, { projection: { username: 1, avatarUrl: 1 } }));
  return NextResponse.json({ user: user ? { username: user.username, avatarUrl: user.avatarUrl ?? null } : null });
}
