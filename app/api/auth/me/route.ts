import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { connectedProviders } from "@/lib/auth/external-identity";

export async function GET() {
  const userId = await currentUserId();
  if (!userId || !ObjectId.isValid(userId)) return NextResponse.json({ user: null });
  const db = await getDb();
  const [user, providers] = await Promise.all([
    db.collection<{ username: string; avatarUrl?: string | null }>("users").findOne({ _id: new ObjectId(userId) }, { projection: { username: 1, avatarUrl: 1 } }),
    connectedProviders(db, userId),
  ]);
  return NextResponse.json({ user: user ? { username: user.username, avatarUrl: user.avatarUrl ?? null, connectedAccounts: providers } : null });
}
