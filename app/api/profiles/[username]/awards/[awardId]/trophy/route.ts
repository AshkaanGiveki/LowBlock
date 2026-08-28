import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { getAwardAsset } from "@/lib/awards/config";
export async function GET(_: Request, { params }: { params: Promise<{ username: string; awardId: string }> }) { const { username, awardId } = await params; if (!ObjectId.isValid(awardId)) return new NextResponse("Not found", { status: 404 }); const db = await getDb(); const user = await db.collection<any>("users").findOne({ normalizedUsername: decodeURIComponent(username).toLowerCase() }, { projection: { _id: 1 } }); const award = user && await db.collection<any>("awards").findOne({ _id: new ObjectId(awardId), userId: String(user._id), scope: "LOWBLOCK" }); const asset = award && getAwardAsset(award); if (!asset) return new NextResponse("Not found", { status: 404 }); try { return new NextResponse(await readFile(asset.trophy), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } }); } catch { return new NextResponse("Not found", { status: 404 }); } }
