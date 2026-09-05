import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getTournamentPreferences, setShowAllMatches, updateTournamentPreference } from "@/lib/football/preferences";

const body = z.object({
  leagueCode: z.string().min(1).optional(),
  favorite: z.boolean().optional(),
  showAllMatches: z.boolean().optional(),
}).refine((value) => value.leagueCode !== undefined && value.favorite !== undefined || value.showAllMatches !== undefined, "Invalid preference update");

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ favoriteTournamentIds: [], showAllMatches: false, authenticated: false });
  return NextResponse.json({ ...(await getTournamentPreferences(userId)), authenticated: true });
}

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_PREFERENCE" }, { status: 400 });
  try {
    const preferences = parsed.data.showAllMatches !== undefined
      ? await setShowAllMatches(userId, parsed.data.showAllMatches)
      : await updateTournamentPreference(userId, parsed.data.leagueCode!, parsed.data.favorite!);
    return NextResponse.json(preferences);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INVALID_PREFERENCE" }, { status: 400 });
  }
}
