import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
export async function GET() { const userId = await currentUserId(); if (!userId || !ObjectId.isValid(userId)) return NextResponse.json({ awards: [] }); const rows = await (await getDb()).collection<any>("awards").find({ userId, revealedAt: null }).sort({ awardedAt: 1 }).toArray(); return NextResponse.json({ awards: rows.map(({ _id, userId: owner, ...award }) => ({ id: String(_id), ...award })) }); }
