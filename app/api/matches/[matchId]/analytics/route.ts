import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import { isPredictionLocked } from "@/lib/domain/predictionLock";
import { getDefendingChampionUserId } from "@/lib/awards/defendingChampion";
import { getOrFetchMatchDetails } from "@/lib/football/sportsapi/matchDetails";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  const url = new URL(req.url);
  const clubId = url.searchParams.get("clubId");
  const db = await getDb();
  const viewer = await currentUserId();
  const match = await db
    .collection<any>("matches")
    .findOne({
      provider: { $in: ["football-api", "sportsapi"] },
      providerMatchId: matchId,
    });
  if (!match)
    return NextResponse.json({ error: "match not found" }, { status: 404 });

  if (clubId) {
    if (!viewer || !ObjectId.isValid(clubId))
      return NextResponse.json(
        { error: "Club access required" },
        { status: 403 },
      );
    const membership = await db
      .collection("clubMemberships")
      .findOne({ clubId, userId: viewer, leftAt: null });
    if (!membership)
      return NextResponse.json(
        { error: "Club membership required" },
        { status: 403 },
      );
  }

  // Fetch or retrieve latest match live details from MongoDB / SportsAPI
  const liveDetails = await getOrFetchMatchDetails(matchId);

  const started =
    ["LIVE", "FINISHED", "SUSPENDED"].includes(String(match.status)) ||
    (match.status === "SCHEDULED" &&
      new Date(match.kickoffAt).getTime() <= Date.now());

  const locked = isPredictionLocked(match);

  let visiblePredictions: any[] = [];
  let userRows: any[] = [];
  const distribution = new Map<string, number>();

  // Only reveal community predictions once the match has kicked off (or in clubs if locked)
  if (started && (locked || clubId)) {
    const predictions = await db
      .collection<any>("predictions")
      .find({ matchId, userId: { $ne: "guest" } })
      .toArray();
    const scoreRows = await db
      .collection<any>("predictionScores")
      .find({ matchId })
      .toArray();
    const scoreByUser = new Map(scoreRows.map((score) => [score.userId, score]));
    const eligibleUserIds = clubId
      ? new Set(
          scoreRows
            .filter((score) => score.clubIdAtLock === clubId)
            .map((score) => String(score.userId)),
        )
      : null;
    visiblePredictions =
      clubId && locked
        ? predictions.filter((prediction) =>
            eligibleUserIds?.has(String(prediction.userId)),
          )
        : predictions;
    const ids = visiblePredictions
      .map((prediction) => prediction.userId)
      .filter((id: string) => ObjectId.isValid(id))
      .map((id: string) => new ObjectId(id));
    const users = ids.length
      ? await db
          .collection<any>("users")
          .find(
            { _id: { $in: ids } },
            { projection: { username: 1, avatarUrl: 1 } },
          )
          .toArray()
      : [];
    const names = new Map(users.map((user) => [String(user._id), user]));

    for (const prediction of visiblePredictions) {
      const key = `${prediction.homeGoals}-${prediction.awayGoals}`;
      distribution.set(key, (distribution.get(key) ?? 0) + 1);
    }
    const championId = await getDefendingChampionUserId(db);
    userRows = visiblePredictions.map((prediction) => {
      const score = scoreByUser.get(prediction.userId);
      return {
        userId: prediction.userId,
        username: names.get(prediction.userId)?.username ?? "LowBlock Player",
        avatarUrl: names.get(prediction.userId)?.avatarUrl ?? null,
        isDefendingChampion: prediction.userId === championId,
        submitted: true,
        homeGoals: prediction.homeGoals,
        awayGoals: prediction.awayGoals,
        points: locked ? Number(score?.points ?? 0) : null,
      };
    });
  }

  const latestHomeGoals = liveDetails?.score?.home ?? match.homeGoals;
  const latestAwayGoals = liveDetails?.score?.away ?? match.awayGoals;
  const latestStatus = liveDetails?.score?.status ?? match.status;
  const latestElapsed = liveDetails?.score?.elapsed ?? match.elapsed;

  const homeLogo = match.homeTeam?.logoUrl || match.homeTeam?.logo || (match.homeTeam?.id ? `/api/team-image/${match.homeTeam.id}` : null);
  const awayLogo = match.awayTeam?.logoUrl || match.awayTeam?.logo || (match.awayTeam?.id ? `/api/team-image/${match.awayTeam.id}` : null);

  return NextResponse.json({
    match: {
      id: match.providerMatchId || matchId,
      providerMatchId: match.providerMatchId || matchId,
      homeTeam: {
        ...match.homeTeam,
        logo: homeLogo,
        logoUrl: homeLogo,
      },
      awayTeam: {
        ...match.awayTeam,
        logo: awayLogo,
        logoUrl: awayLogo,
      },
      homeGoals: latestHomeGoals,
      awayGoals: latestAwayGoals,
      leagueCode: match.leagueCode,
      matchday: match.matchday,
      status: latestStatus,
      elapsed: latestElapsed ?? null,
      kickoffAt: new Date(match.kickoffAt).toISOString(),
    },
    locked,
    started,
    liveDetails,
    total: visiblePredictions.length,
    averagePoints: userRows.length
      ? userRows.reduce((sum, row) => sum + Number(row.points ?? 0), 0) /
        userRows.length
      : 0,
    distribution: [...distribution.entries()]
      .map(([score, count]) => ({ score, count }))
      .sort((a, b) => b.count - a.count),
    users: userRows,
  });
}
