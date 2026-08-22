import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { currentMembership } from "@/lib/domain/clubs";
export async function POST(_req: Request, { params }: { params: Promise<{ clubId: string }> }) { const userId = await currentUserId(); const { clubId } = await params; if (!userId || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const db = await getDb(); const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId), discoveryMode: "RECRUITING" }); if (!club) return NextResponse.json({ error: "Club is not recruiting" }, { status: 404 }); const membership = await currentMembership(db, userId); if (membership?.clubId === clubId) return NextResponse.json({ error: "ALREADY_MEMBER" }, { status: 409 }); const existing = await db.collection("clubJoinRequests").findOne({ clubId, userId, status: "PENDING" }); if (existing) return NextResponse.json({ error: "REQUEST_ALREADY_PENDING" }, { status: 409 }); const now = new Date(); await db.collection("clubJoinRequests").insertOne({ clubId, userId, status: "PENDING", createdAt: now, updatedAt: now }); return NextResponse.json({ ok: true }, { status: 201 }); }

