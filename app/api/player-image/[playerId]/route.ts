import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params;
  const cleanId = String(playerId || "").replace(/\.png$/i, "").trim();

  if (!cleanId || !/^\d+$/.test(cleanId) || cleanId === "0") {
    return new NextResponse(null, { status: 404 });
  }

  // Player images must never consume SportsAPI quota. Use the public image CDN
  // directly; SportsAPI is reserved for football data discovery and scores.
  try {
    const sofascoreUrl = `https://img.sofascore.com/api/v1/player/${cleanId}/image`;
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
