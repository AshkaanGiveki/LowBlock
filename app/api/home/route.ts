import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";
import {
  getLeaderboardSummary,
  getCachedCanonicalLeaderboard,
} from "@/lib/domain/leaderboards";
import { getMatchesPage, getPredictions } from "@/lib/football/data";
import { getViewerH2HTodayMatch } from "@/lib/domain/h2h";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await currentUserId();
    // Cache the shared upcoming list first; most signed-in users can be
    // filtered with one indexed user-prediction query instead of a per-match
    // lookup across the fixtures collection on every homepage refresh.
    const sharedPage = await getMatchesPage(userId ? 30 : 5, null, {
      upcomingOnly: true,
    });
    let page = sharedPage;
    if (userId) {
      const predicted = await getPredictions(
        sharedPage.matches.map((match) => match.providerMatchId),
        userId,
      );
      const available = sharedPage.matches.filter(
        (match) => !predicted.has(match.providerMatchId),
      );
      if (available.length >= 5 || !sharedPage.hasMore) {
        page = { ...sharedPage, matches: available.slice(0, 5) };
      } else {
        page = await getMatchesPage(5, null, {
          upcomingOnly: true,
          unpredictedFor: userId,
        });
      }
    }
    const allPredicted =
      userId && page.matches.length === 0
        ? (await getMatchesPage(1, null, { upcomingOnly: true })).matches
            .length > 0
        : false;
    const base = {
      matches: page.matches,
      predictions: {},
      allPredicted: Boolean(allPredicted),
      username: "",
      rank: "—" as string | number,
      points: 0,
      exact: 0,
      clubName: null as string | null,
      rows: [] as unknown[],
      h2hTodayMatch: null as unknown,
    };
    if (
      !userId ||
      new URL(request.url).searchParams.get("fixturesOnly") === "1"
    )
      return NextResponse.json(base);
    // Optional dashboard data must never prevent the prediction feed from loading.
    try {
      const db = await getDb();
      const [user, membership, todayMatch, mine, rows] = await Promise.all([
        db
          .collection<any>("users")
          .findOne(
            { _id: new ObjectId(userId) },
            { projection: { username: 1 } },
          ),
        db
          .collection<any>("clubMemberships")
          .findOne({ userId, leftAt: null }, { projection: { clubId: 1 } }),
        getViewerH2HTodayMatch(db, userId).catch(() => null),
        getLeaderboardSummary(db, userId, { weekly: true }),
        getCachedCanonicalLeaderboard(db, { weekly: true }, 7),
      ]);
      let clubName: string | null = null;
      if (membership && ObjectId.isValid(String(membership.clubId))) {
        const club = await db
          .collection<any>("clubs")
          .findOne(
            { _id: new ObjectId(String(membership.clubId)) },
            { projection: { name: 1 } },
          );
        clubName = club?.name ?? null;
      }
      return NextResponse.json({
        ...base,
        username: user?.username ?? "",
        rank: mine?.rank ?? "—",
        points: mine?.points ?? 0,
        exact: mine?.exact ?? 0,
        clubName,
        rows,
        h2hTodayMatch: todayMatch,
      });
    } catch (error) {
      console.error("[home] Dashboard unavailable", error);
      return NextResponse.json(base);
    }
  } catch (error) {
    console.error("[home] Fixtures unavailable", error);
    return NextResponse.json(
      { error: "Fixtures unavailable" },
      { status: 503 },
    );
  }
}
