import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb, withMongoTransaction } from "@/lib/db/mongo";
import { currentMembership, refreshClubState } from "@/lib/domain/clubs";

export async function POST(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const userId = await currentUserId();
  const { clubId } = await params;
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!ObjectId.isValid(clubId)) return NextResponse.json({ error: "CLUB_NOT_FOUND" }, { status: 404 });
  const db = await getDb();
  try {
    await withMongoTransaction(async (transactionDb, session) => {
      const club = await transactionDb.collection<any>("clubs").findOne({ _id: new ObjectId(clubId), discoveryMode: "RECRUITING", visibility: "PUBLIC" }, { session });
      if (!club) throw new Error("CLUB_NOT_RECRUITING");
      const membership = await transactionDb.collection<any>("clubMemberships").findOne({ userId, leftAt: null }, { session });
      if (membership?.clubId === clubId) throw new Error("ALREADY_MEMBER");
      const pending = await transactionDb.collection<any>("clubJoinRequests").findOne({ userId, status: "PENDING" }, { session });
      if (pending) throw new Error("REQUEST_ALREADY_PENDING");
      const now = new Date();
      await transactionDb.collection("clubJoinRequests").insertOne({ clubId, userId, status: "PENDING", createdAt: now, updatedAt: now }, { session });
    });
    return NextResponse.json({ ok: true, status: "PENDING", clubId }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "JOIN_REQUEST_FAILED";
    const status = ["ALREADY_MEMBER", "REQUEST_ALREADY_PENDING"].includes(code) ? 409 : code === "CLUB_NOT_RECRUITING" ? 404 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
