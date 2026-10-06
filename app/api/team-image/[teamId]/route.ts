import { NextResponse } from "next/server";
import { env } from "@/lib/env";

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

  const apiKey = env.SPORTSAPI_API_KEY || process.env.SPORTSAPI_API_KEY;

  // 1. Try SportsAPI if API key is provided
  if (apiKey) {
    try {
      const imageUrl = `https://v2.football.sportsapipro.com/images/teams/${cleanTeamId}`;
      const response = await fetch(imageUrl, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(4000),
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
    } catch {
      // Continue to Sofascore fallback
    }
  }

  // 2. Direct fallback to Sofascore team image CDN (bypassing hotlink protection and client ISP filtering)
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
