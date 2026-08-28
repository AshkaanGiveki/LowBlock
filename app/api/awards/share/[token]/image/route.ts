import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongo";
import { getAwardAsset } from "@/lib/awards/config";
import { hashAwardShareToken } from "@/lib/awards/shareToken";
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) { const { token } = await params; if (!/^[A-Za-z0-9_-]{6}$/.test(token) && !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return new NextResponse("Not found", { status: 404 }); const award = await (await getDb()).collection<any>("awards").findOne({ shareTokenHash: hashAwardShareToken(token), scope: { $in: ["LOWBLOCK", "CLUB"] } }); const asset = award && getAwardAsset(award); if (!asset) return new NextResponse("Not found", { status: 404 }); try { return new NextResponse(await readFile(asset.shareCard), { headers: { "Content-Type": asset.shareCard.toLowerCase().endsWith(".webp") ? "image/webp" : "image/png", "Cache-Control": "public, max-age=300", "Content-Disposition": "inline" } }); } catch { return new NextResponse("Not found", { status: 404 }); } }
