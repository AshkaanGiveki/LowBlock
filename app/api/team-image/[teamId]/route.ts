import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const apiKey = env.SPORTSAPI_API_KEY || process.env.SPORTSAPI_API_KEY;

  if (!apiKey || !teamId) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const imageUrl = `https://v2.football.sportsapipro.com/images/teams/${teamId}`;
    const response = await fetch(imageUrl, {
      headers: { "x-api-key": apiKey },
      // Cache at Next.js fetch level
      next: { revalidate: 2592000 },
    });

    if (!response.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=2592000, stale-while-revalidate=86400, immutable",
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}
