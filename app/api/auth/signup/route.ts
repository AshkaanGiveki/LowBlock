import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/mongo";
import { hashPassword } from "@/lib/auth/password";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";
import { createSession } from "@/lib/auth/session";
import { cookies } from "next/headers"; import { attachIdentity, readPending } from "@/lib/platform/identity";
const body = z.object({ username: z.string().min(3).max(24), password: z.string().min(8).max(128) });
export async function POST(req: Request) {
  try {
    const parsed = body.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: "اطلاعات واردشده معتبر نیست" }, { status: 400 });
    const username = parsed.data.username.trim(); if (!isValidUsername(username)) return NextResponse.json({ error: "نام کاربری معتبر نیست" }, { status: 400 });
    const db = await getDb(); const now = new Date();
    const pending=readPending((await cookies()).get("lowblock_platform_pending")?.value); const result = await db.collection("users").insertOne({ username, normalizedUsername: normalizeUsername(username), passwordHash: await hashPassword(parsed.data.password), favoriteTournamentIds: [], favoriteTournamentExclusions: [], showAllMatches: false, createdAt: now, updatedAt: now });
    const userId=result.insertedId.toString(); try { if(pending) await attachIdentity(userId,pending.provider,pending.user); } catch(error) { if(error instanceof Error&&error.message==="PLATFORM_IDENTITY_CONFLICT") return NextResponse.json({ error: "This platform account is already linked to another LowBlock account." }, { status: 409 }); throw error; } const session = await createSession(userId); const response = NextResponse.json({ ok: true }, { status: 201 });
    response.cookies.set(session.name, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: session.maxAge }); response.cookies.set("lowblock_platform_pending","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0}); return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000) return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است" }, { status: 409 });
    return NextResponse.json({ error: "ثبت‌نام موقتاً در دسترس نیست" }, { status: 503 });
  }
}
