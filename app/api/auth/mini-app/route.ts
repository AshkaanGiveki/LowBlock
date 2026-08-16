import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/db/mongo";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeUsername } from "@/lib/auth/username";
import { createSession, currentUserId, setSessionCookie } from "@/lib/auth/session";
import { MiniAppAuthError, miniAppToken, verifyMiniAppInitData } from "@/lib/auth/mini-app";
import { createPlatformUser, ensureIdentityIndexes, findIdentity, linkIdentity } from "@/lib/auth/external-identity";

const inputSchema = z.object({
  provider: z.enum(["telegram", "bale"]),
  initData: z.string().min(1).max(16_384),
  action: z.enum(["authenticate", "create", "linkCredentials"]).default("authenticate"),
  username: z.string().min(3).max(24).optional(),
  password: z.string().min(8).max(128).optional(),
});

function maxAgeSeconds() {
  const value = Number(process.env.MINI_APP_AUTH_MAX_AGE_SECONDS ?? 600);
  return Number.isSafeInteger(value) && value >= 60 && value <= 3600 ? value : 600;
}

async function sessionResponse(userId: string, status = 200) {
  const session = await createSession(userId);
  const response = NextResponse.json({ ok: true }, { status });
  setSessionCookie(response, session);
  return response;
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid Mini App request" }, { status: 400 });
  const token = miniAppToken(parsed.data.provider);
  if (!token) return NextResponse.json({ error: `${parsed.data.provider} is not configured` }, { status: 503 });

  try {
    const launch = verifyMiniAppInitData(parsed.data.provider, parsed.data.initData, token, { maxAgeSeconds: maxAgeSeconds() });
    const db = await getDb();
    await ensureIdentityIndexes(db);
    const identity = await findIdentity(db, launch.provider, launch.user.id);

    if (parsed.data.action === "authenticate" && identity) return sessionResponse(identity.userId);

    let targetUserId = await currentUserId();
    if (targetUserId && !ObjectId.isValid(targetUserId)) targetUserId = null;

    if (parsed.data.action === "linkCredentials") {
      if (!parsed.data.username || !parsed.data.password) return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
      const user = await db.collection<{ passwordHash?: string | null }>("users").findOne({ normalizedUsername: normalizeUsername(parsed.data.username) });
      if (!user?.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
        return NextResponse.json({ error: "Username or password is incorrect" }, { status: 401 });
      }
      targetUserId = user._id.toHexString();
    }

    if (targetUserId) {
      const linked = await linkIdentity(db, launch, targetUserId);
      if (!linked.ok) return NextResponse.json({ error: "This platform account is already connected to another LowBlock account", code: linked.reason }, { status: 409 });
      return sessionResponse(targetUserId);
    }

    if (parsed.data.action === "authenticate") {
      return NextResponse.json({
        error: "Choose how to continue",
        code: "ACCOUNT_SETUP_REQUIRED",
        platformProfile: { firstName: launch.user.firstName, username: launch.user.username ?? null },
      }, { status: 409 });
    }

    if (parsed.data.action !== "create") return NextResponse.json({ error: "Sign in to link this account" }, { status: 401 });
    const created = await createPlatformUser(db, launch);
    return sessionResponse(created.userId, 201);
  } catch (error) {
    if (error instanceof MiniAppAuthError) return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
    if (error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "This platform account was connected in another request. Please retry." }, { status: 409 });
    }
    return NextResponse.json({ error: "Mini App sign-in is temporarily unavailable" }, { status: 503 });
  }
}
