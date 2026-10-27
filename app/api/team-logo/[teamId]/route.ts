import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { teamLogoFile } from "@/lib/football/teamLogos";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const file = teamLogoFile(teamId);
  if (!file) return new NextResponse(null, { status: 404 });
  try {
    return new NextResponse(await readFile(file), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=2592000, immutable" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
