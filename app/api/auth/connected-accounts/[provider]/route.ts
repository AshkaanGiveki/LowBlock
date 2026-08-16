import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";

export async function DELETE(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const userId = await currentUserId();
  if (!userId || !ObjectId.isValid(userId)) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { provider } = await params;
  if (provider !== "telegram" && provider !== "bale") return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  const db = await getDb();
  const [user, identityCount] = await Promise.all([
    db.collection<{ passwordHash?: string | null }>("users").findOne({ _id: new ObjectId(userId) }, { projection: { passwordHash: 1 } }),
    db.collection("externalIdentities").countDocuments({ userId }),
  ]);
  if (!user?.passwordHash && identityCount <= 1) {
    return NextResponse.json({ error: "Set a website password before disconnecting your only sign-in method", code: "PASSWORD_REQUIRED" }, { status: 409 });
  }
  const result = await db.collection("externalIdentities").deleteOne({ userId, provider });
  if (!result.deletedCount) return NextResponse.json({ error: "This account is not connected" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
