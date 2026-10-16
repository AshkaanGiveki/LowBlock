import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isH2HEnabled } from "@/lib/domain/h2h";

export async function requireH2HAdmin() {
  if (!isH2HEnabled()) return { response: NextResponse.json({ error: "H2H_DISABLED" }, { status: 404 }) };
  const userId = await currentUserId();
  if (!userId || !ObjectId.isValid(userId)) return { response: NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 }) };
  const user = await (await getDb()).collection<any>("users").findOne({ _id: new ObjectId(userId) }, { projection: { role: 1, isAdmin: 1 } });
  if (!user || (user.role !== "ADMIN" && user.role !== "admin" && user.isAdmin !== true)) return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { userId, db: await getDb() };
}
