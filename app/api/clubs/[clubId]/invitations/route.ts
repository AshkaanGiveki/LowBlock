import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
const body = z.object({ email: z.string().email().optional(), username: z.string().trim().min(2).max(40).optional() }).refine(value => value.email || value.username);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function POST(req: Request, { params }: { params: Promise<{ clubId: string }> }) { const ownerId = await currentUserId(); const { clubId } = await params; if (!ownerId || !ObjectId.isValid(clubId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const parsed = body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Enter an email or username" }, { status: 400 }); const db = await getDb(); const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId), ownerId }); if (!club) return NextResponse.json({ error: "Owner permission required" }, { status: 403 }); const token = randomBytes(24).toString("hex"); const now = new Date(); await db.collection("clubInvitations").insertOne({ clubId, ...parsed.data, tokenHash: hash(token), status: "PENDING", createdAt: now, expiresAt: new Date(now.getTime() + 7 * 864e5) }); return NextResponse.json({ ok: true, inviteToken: token }); }

