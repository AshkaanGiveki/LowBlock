import { NextResponse } from "next/server";
import { requireH2HAdmin } from "@/lib/auth/h2h-admin";
import { H2H_ALLOWED_COMPETITION_CODES, getH2HWeek } from "@/lib/domain/h2h";
export async function GET() {
  const auth = await requireH2HAdmin(); if ("response" in auth) return auth.response;
  const week = getH2HWeek();
  const [teams, matches] = await Promise.all([
    auth.db.collection<any>("centralTeams").countDocuments({ h2hRating: { $gte: 1, $lte: 100 }, numericTeamId: { $gt: 0 } }),
    auth.db.collection<any>("matches").countDocuments({ leagueCode: { $in: H2H_ALLOWED_COMPETITION_CODES }, kickoffAt: { $gte: week.start, $lt: week.end } }),
  ]);
  return NextResponse.json({ week, allowedCompetitions: H2H_ALLOWED_COMPETITION_CODES, ratedNumericTeams: teams, candidateMatches: matches });
}
