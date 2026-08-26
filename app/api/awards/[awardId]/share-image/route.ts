import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { getRoundWinnerAsset } from "@/lib/awards/config";
export async function GET(_: Request, { params }: { params: Promise<{ awardId: string }> }) { const userId = await currentUserId(); const { awardId } = await params; if (!userId || !ObjectId.isValid(userId) || !ObjectId.isValid(awardId)) return new NextResponse("Unauthorized", { status: 401 }); const award = await (await getDb()).collection<any>("awards").findOne({ _id: new ObjectId(awardId), userId }); const asset = award && getRoundWinnerAsset(award.competitionId, award.seasonStartYear, award.roundNumber); if (!asset) return new NextResponse("Not found", { status: 404 }); try { return new NextResponse(await readFile(asset.shareCard), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="lowblock-${award.competitionId.toLowerCase()}-round-winner.png"`, "Cache-Control": "private, max-age=300" } }); } catch { return new NextResponse("Not found", { status: 404 }); } }
