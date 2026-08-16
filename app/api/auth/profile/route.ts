import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { hashPassword } from "@/lib/auth/password";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId || !ObjectId.isValid(userId)) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as { username?: unknown; password?: unknown; avatarData?: unknown } | null;
  const username = typeof input?.username === "string" ? input.username.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  const avatarUrl = typeof input?.avatarData === "string" ? input.avatarData.trim() : "";
  if (!isValidUsername(username)) return NextResponse.json({ error: "Choose a valid username" }, { status: 400 });
  if (password && (password.length < 8 || password.length > 128)) return NextResponse.json({ error: "Password must be 8–128 characters" }, { status: 400 });
  if (avatarUrl && (!/^data:image\/(png|jpe?g|webp);base64,/i.test(avatarUrl) || avatarUrl.length > 2_800_000)) return NextResponse.json({ error: "Use a PNG, JPEG, or WebP image under 2 MB" }, { status: 400 });
  const update: Record<string, unknown> = { username, normalizedUsername: normalizeUsername(username), avatarUrl: avatarUrl || null, updatedAt: new Date() };
  if (password) update.passwordHash = await hashPassword(password);
  try {
    await getDb().then((db) => db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: update }));
    return NextResponse.json({ ok: true, user: { username, avatarUrl: avatarUrl || null } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000) return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    return NextResponse.json({ error: "Profile could not be updated" }, { status: 503 });
  }
}
