import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongo";
import { centralTeamLogo } from "@/lib/football/centralTeams";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const cleanTeamId = String(teamId || "").replace(/\.png$/i, "").trim();

  if (!cleanTeamId || !/^\d+$/.test(cleanTeamId) || cleanTeamId === "0") {
    return new NextResponse(null, { status: 404 });
  }

  // SportsAPI match IDs are not SofaScore IDs. Resolve the SportsAPI ID
  // through the central-team bridge and use the already-linked API-Football
  // crest whenever possible; this keeps image loading outside SportsAPI quota.
  try {
    const db = await getDb();
    const central = await db.collection<any>("centralTeams").findOne(
      { "providerIds.sportsapi": cleanTeamId },
      { projection: { logoUrl: 1, providerIds: 1 } },
    );
    const logoUrl = centralTeamLogo(central);
    if (logoUrl) {
      const response = await fetch(logoUrl, {
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 2592000 },
      });
      if (response.ok) {
        return new NextResponse(await response.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": response.headers.get("content-type") || "image/png",
            "Cache-Control": "public, max-age=2592000, stale-while-revalidate=86400, immutable",
          },
        });
      }
    }
  } catch {
    // Continue to the public fallback below.
  }

  // Team images must never consume SportsAPI quota. Use the public image CDN
  // directly; match discovery and scores are the only SportsAPI data path.
  try {
    const sofascoreUrl = `https://img.sofascore.com/api/v1/team/${cleanTeamId}/image`;
    const response = await fetch(sofascoreUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.sofascore.com/",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 2592000 },
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type") || "image/png";
      const buffer = await response.arrayBuffer();

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control":
            "public, max-age=2592000, stale-while-revalidate=86400, immutable",
        },
      });
    }

    if (response.status === 404) {
      return new NextResponse(null, {
        status: 404,
        headers: {
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch {
    // Network / timeout
  }

  return new NextResponse(null, { status: 404 });
}
