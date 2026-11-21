import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";

export async function requireAdmin() {
  const userId = await currentUserId();
  if (!userId || !ObjectId.isValid(userId)) {
    return { response: NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 }) };
  }
  const db = await getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { role: 1, isAdmin: 1, username: 1 } },
  );
  if (!user || (user.role !== "ADMIN" && user.role !== "admin" && user.isAdmin !== true)) {
    return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }
  return { userId, db, user };
}
