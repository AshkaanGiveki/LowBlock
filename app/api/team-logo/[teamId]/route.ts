import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { teamLogoFile, cleanSportsApiTeamId } from "@/lib/football/teamLogos";
import { getDb } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  // The frontend sometimes passes a centralTeamId (sportsapi:123) rather than a numeric provider ID.\n  const embeddedId = /^sportsapi:(\\d+)$/.exec(teamId)?.[1];\n  const resolvedId = embeddedId || teamId;\n  const file = teamLogoFile(resolvedId);
  if (file) {
    try {
      return new NextResponse(await readFile(file), {
        status: 200,
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    } catch {
      // Restore the previous working remote image fallback on a cache miss.
    }
  }
  let sportsApiId = cleanSportsApiTeamId(resolvedId);
  if (!sportsApiId) {
    try {
      const db = await getDb();
      const central = await db.collection("centralTeams").findOne({ centralTeamId: teamId });
      sportsApiId = cleanSportsApiTeamId(central?.providerIds?.sportsapi);
    } catch {}
  }
  if (!sportsApiId) return new NextResponse(null, { status: 404 });
  try {
    const response = await fetch(`https://img.sofascore.com/api/v1/team/${sportsApiId}/image`, {
      headers: {
        Accept: "image/*",
        "User-Agent": "Mozilla/5.0 (compatible; LowBlock/1.0)",
        Referer: "https://www.sofascore.com/",
      },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (response.ok && (response.headers.get("content-type") || "").startsWith("image/")) {
      return new NextResponse(await response.arrayBuffer(), {
        status: 200,
        headers: {
          "Content-Type": response.headers.get("content-type") || "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch {}
  return new NextResponse(null, { status: 404 });
}
