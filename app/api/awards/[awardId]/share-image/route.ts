import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getAwardAsset, getAwardAssetContentType } from "@/lib/awards/config";
export async function GET(_: Request, { params }: { params: Promise<{ awardId: string }> }) { const userId = await currentUserId(); const { awardId } = await params; if (!userId || !ObjectId.isValid(userId) || !ObjectId.isValid(awardId)) return new NextResponse("Unauthorized", { status: 401 }); const award = await (await getDb()).collection<any>("awards").findOne({ _id: new ObjectId(awardId), userId }); const asset = award && getAwardAsset(award); if (!asset) return new NextResponse("Not found", { status: 404 }); try { return new NextResponse(await readFile(asset.shareCard), { headers: { "Content-Type": getAwardAssetContentType(asset.shareCard), "Content-Disposition": `attachment; filename="lowblock-${String(award.type ?? "award").toLowerCase()}${asset.shareCard.toLowerCase().endsWith(".webp") ? ".webp" : ".png"}"`, "Cache-Control": "private, max-age=300" } }); } catch { return new NextResponse("Not found", { status: 404 }); } }
