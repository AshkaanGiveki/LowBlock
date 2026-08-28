import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
export async function GET(request: Request) { const userId = await currentUserId(); if (!userId || !ObjectId.isValid(userId)) return NextResponse.json({ awards: [] }); const repeatDemo = process.env.NODE_ENV !== "production" && new URL(request.url).searchParams.get("repeatDemo") === "1"; const query = repeatDemo ? { userId, demo: true, scope: "LOWBLOCK" } : { userId, revealedAt: null }; const rows = await (await getDb()).collection<any>("awards").find(query).sort({ awardedAt: 1 }).toArray(); return NextResponse.json({ awards: rows.map(({ _id, userId: owner, ...award }) => ({ id: String(_id), ...award })) }); }
