import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb, withMongoTransaction } from "@/lib/db/mongo";
import { refreshClubState } from "@/lib/domain/clubs";
import { getDefendingChampionUserId } from "@/lib/awards/defendingChampion";

const body = z.object({ action: z.enum(["ACCEPT", "DECLINE", "CANCEL"]), requestId: z.string().min(1), confirmSwitch: z.boolean().default(false) });

export async function GET(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const actor = await currentUserId();
  const { clubId } = await params;
  if (!actor || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const db = await getDb();
  const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId) }, { projection: { ownerId: 1, name: 1, imageUrl: 1 } });
  if (!club || club.ownerId !== actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const requests = await db.collection<any>("clubJoinRequests").find({ clubId, status: "PENDING" }).sort({ createdAt: 1 }).toArray();
  const ids = requests.filter((request) => ObjectId.isValid(request.userId)).map((request) => new ObjectId(request.userId));
  const users = await db.collection<any>("users").find({ _id: { $in: ids } }, { projection: { username: 1, avatarUrl: 1 } }).toArray();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const championId = await getDefendingChampionUserId(db);
  return NextResponse.json({ club: { name: club.name, imageUrl: club.imageUrl ?? null }, requests: requests.map((request) => ({ ...request, _id: String(request._id), isDefendingChampion: request.userId === championId, user: byId.get(request.userId) ? { username: byId.get(request.userId).username, avatarUrl: byId.get(request.userId).avatarUrl ?? null } : null })) });
}

export async function POST(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const actor = await currentUserId();
  const { clubId } = await params;
  if (!actor || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !ObjectId.isValid(parsed.data.requestId)) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const db = await getDb();
  const requestId = new ObjectId(parsed.data.requestId);
  const request = await db.collection<any>("clubJoinRequests").findOne({ _id: requestId, clubId });
  if (!request) return NextResponse.json({ error: "REQUEST_NOT_FOUND" }, { status: 404 });
  const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId) });
  if (!club) return NextResponse.json({ error: "CLUB_NOT_FOUND" }, { status: 404 });

  if (parsed.data.action === "CANCEL") {
    if (request.userId !== actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    await db.collection("clubJoinRequests").updateOne({ _id: requestId, status: "PENDING" }, { $set: { status: "CANCELLED", updatedAt: new Date() } });
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  }
  if (club.ownerId !== actor) return NextResponse.json({ error: "OWNER_PERMISSION_REQUIRED" }, { status: 403 });
  if (parsed.data.action === "DECLINE") {
    const result = await db.collection("clubJoinRequests").updateOne({ _id: requestId, status: "PENDING" }, { $set: { status: "DECLINED", updatedAt: new Date() } });
    return NextResponse.json({ ok: result.modifiedCount === 1, status: "DECLINED" });
  }

  try {
    await withMongoTransaction(async (transactionDb, session) => {
      const pending = await transactionDb.collection<any>("clubJoinRequests").findOne({ _id: requestId, clubId, status: "PENDING" }, { session });
      if (!pending) throw new Error("REQUEST_ALREADY_RESOLVED");
      const existing = await transactionDb.collection<any>("clubMemberships").findOne({ userId: pending.userId, leftAt: null }, { session });
      if (existing && existing.clubId !== clubId && !parsed.data.confirmSwitch) throw new Error("SWITCH_CONFIRMATION_REQUIRED");
      if (existing?.clubId === clubId) throw new Error("ALREADY_MEMBER");
      if (existing) {
        const currentClub = await transactionDb.collection<any>("clubs").findOne({ _id: new ObjectId(existing.clubId) }, { session });
        if (currentClub?.ownerId === pending.userId) throw new Error("TRANSFER_OWNERSHIP_FIRST");
        await transactionDb.collection("clubMemberships").updateOne({ _id: existing._id, leftAt: null }, { $set: { leftAt: new Date() } }, { session });
      }
      const now = new Date();
      await transactionDb.collection("clubMemberships").insertOne({ clubId, userId: pending.userId, role: "MEMBER", joinedAt: now, leftAt: null }, { session });
      const result = await transactionDb.collection("clubJoinRequests").updateOne({ _id: requestId, status: "PENDING" }, { $set: { status: "ACCEPTED", updatedAt: now } }, { session });
      if (result.modifiedCount !== 1) throw new Error("REQUEST_ALREADY_RESOLVED");
    });
    const members = await refreshClubState(db, clubId);
    return NextResponse.json({ ok: true, status: "ACCEPTED", members });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ACCEPT_REQUEST_FAILED";
    if (code === "SWITCH_CONFIRMATION_REQUIRED") return NextResponse.json({ requiresSwitchConfirmation: true, currentClubId: (await db.collection<any>("clubMemberships").findOne({ userId: request.userId, leftAt: null }))?.clubId ?? null, message: "Joining this Club will leave the current Club." }, { status: 409 });
    const status = ["ALREADY_MEMBER", "TRANSFER_OWNERSHIP_FIRST", "REQUEST_ALREADY_RESOLVED"].includes(code) ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
