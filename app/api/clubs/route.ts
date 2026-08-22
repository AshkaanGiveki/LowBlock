import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { createClub, currentMembership } from "@/lib/domain/clubs";

const body = z.object({ name: z.string().trim().min(2).max(60), imageUrl: z.string().url().nullable().optional(), discoveryMode: z.enum(["INVITE_ONLY", "RECRUITING"]).default("INVITE_ONLY"), visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC") });

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ club: null });
  const db = await getDb();
  const membership = await currentMembership(db, userId);
  const club = membership ? await db.collection("clubs").findOne({ _id: new (await import("mongodb")).ObjectId(membership.clubId) }) : null;
  return NextResponse.json({ club, membership });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid Club name" }, { status: 400 });
  try { return NextResponse.json({ club: await createClub(await getDb(), userId, { ...parsed.data, imageUrl: parsed.data.imageUrl ?? null }) }, { status: 201 }); }
  catch (error) { const code = error instanceof Error ? error.message : "CLUB_CREATE_FAILED"; return NextResponse.json({ error: code }, { status: code === "USER_ALREADY_OWNS_CLUB" || code === "USER_ALREADY_IN_CLUB" ? 409 : 400 }); }
}

