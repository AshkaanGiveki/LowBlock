import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/mongo";
import type { NextResponse } from "next/server";

const COOKIE_NAME = "lowblock_session";
const SESSION_DAYS = 30;
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex"); const now = new Date();
  await getDb().then((db) => db.collection("sessions").insertOne({ userId, tokenHash: hashToken(token), createdAt: now, expiresAt: new Date(now.getTime() + SESSION_DAYS * 864e5) }));
  return { name: COOKIE_NAME, value: token, maxAge: SESSION_DAYS * 86400 };
}
export async function currentUserId() {
  const token = (await cookies()).get(COOKIE_NAME)?.value; if (!token) return null;
  const session = await getDb().then((db) => db.collection<{ userId: string; expiresAt: Date }>("sessions").findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }));
  return session?.userId ?? null;
}
export function setSessionCookie(response: NextResponse, session: Awaited<ReturnType<typeof createSession>>) {
  response.cookies.set(session.name, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: session.maxAge });
}
