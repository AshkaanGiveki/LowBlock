import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/mongo";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeUsername } from "@/lib/auth/username";
import { createSession } from "@/lib/auth/session";
import { cookies } from "next/headers"; import { attachIdentity, readPending } from "@/lib/platform/identity";
const body = z.object({ username: z.string().min(3).max(24), password: z.string().min(8).max(128) });
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "نام کاربری یا رمز عبور معتبر نیست" }, { status: 400 });
  const user = await getDb().then((db) => db.collection<{ _id: { toString(): string }; passwordHash: string }>("users").findOne({ normalizedUsername: normalizeUsername(parsed.data.username) }));
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
  const userId=String(user._id); const pending=readPending((await cookies()).get("lowblock_platform_pending")?.value); if(pending) await attachIdentity(userId,pending.provider,pending.user); const session = await createSession(userId); const response = NextResponse.json({ ok: true });
  response.cookies.set(session.name, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: session.maxAge }); response.cookies.set("lowblock_platform_pending","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0}); return response;
}
