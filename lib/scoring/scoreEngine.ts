import { ObjectId } from "mongodb";
import { getDb, withMongoTransaction } from "@/lib/db/mongo";
import { calculatePredictionScore } from "@/lib/scoring/calculatePredictionScore";
import {
  createLockSnapshot,
  isPredictionLocked,
  SCORING_VERSION,
} from "@/lib/domain/predictionLock";
import { grantAutomaticAwards } from "@/lib/awards/service";
import {
  DEFAULT_CLUB_LEAGUE_CODES,
  getLeague,
  isGlobalCompetition,
  isFeaturedFixture,
} from "@/lib/football/leagues";
import { writeRankSnapshots } from "@/lib/domain/rankSnapshots";

type Match = {
  _id?: unknown;
  providerMatchId: string;
  leagueCode: string;
  seasonStartYear: number;
  matchday: number;
  roundId?: string | null;
  status: string;
  kickoffAt: Date;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
};
type Prediction = {
  _id?: unknown;
  userId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  createdAt?: Date;
};

// Kept for the existing Club views. Low Block awards use the canonical leaderboard below.
async function rebuildRoundWinners(db: Awaited<ReturnType<typeof getDb>>) {
  const rounds = await db
    .collection<any>("rounds")
    .find({ status: "FINAL" })
    .toArray();
  for (const round of rounds) {
    const rows = await db
      .collection<any>("predictionScores")
      .aggregate([
        {
          $match: {
            leagueCode: round.leagueCode,
            seasonStartYear: Number(round.seasonId),
            matchday: round.number,
          },
        },
        {
          $group: {
            _id: { userId: "$userId", clubId: "$clubIdAtLock" },
            points: { $sum: "$points" },
            exact: { $sum: { $cond: ["$exactScore", 1, 0] } },
            predictions: { $sum: 1 },
          },
        },
        { $sort: { points: -1, exact: -1, predictions: -1, "_id.userId": 1 } },
      ])
      .toArray();
    await db.collection("roundWinners").deleteMany({ roundId: round.id });
    const scopes = new Map<string, any>();
    for (const row of rows) {
      const clubId = row._id.clubId ?? null;
      if (!clubId && !isGlobalCompetition(round.leagueCode)) continue;
      const key = clubId ?? "GLOBAL";
      if (!scopes.has(key)) scopes.set(key, row);
    }
    if (scopes.size)
      await db
        .collection("roundWinners")
        .insertMany(
          [...scopes.values()].map((row) => ({
            roundId: round.id,
            userId: String(row._id.userId),
            clubId: row._id.clubId ?? null,
            points: Number(row.points ?? 0),
            exact: Number(row.exact ?? 0),
            predictions: Number(row.predictions ?? 0),
            createdAt: new Date(),
          })),
        );
  }
  return rounds.length;
}

/**
 * The only write path for prediction scores. It is safe to run repeatedly:
 * each score is replaced for the same prediction/match and stats are rebuilt
 * from the canonical score rows rather than incremented.
 */
export async function runScoreEngine(
  options: { rebuildLeaderboards?: boolean; matchIds?: string[] } = {},
) {
  const rebuildLeaderboards = options.rebuildLeaderboards ?? true;
  const requestedMatchIds = [
    ...new Set((options.matchIds ?? []).map(String).filter(Boolean)),
  ];
  const db = await getDb();
  const matches = await db
    .collection<Match>("matches")
    .find({
      provider: { $in: ["football-api", "sportsapi"] },
      status: "FINISHED",
      homeGoals: { $ne: null },
      awayGoals: { $ne: null },
      ...(requestedMatchIds.length
        ? { providerMatchId: { $in: requestedMatchIds } }
        : {}),
    })
    .toArray();
  if (!matches.length)
    return {
      matches: 0,
      scores: 0,
      leaderboards: 0,
      touchedUsers: [] as string[],
      awards: rebuildLeaderboards ? await grantAutomaticAwards(db) : null,
    };
  const byMatch = new Map(
    matches.map((match) => [match.providerMatchId, match]),
  );
  // Keep the provider-match lookup bounded. A single large `$in` query can
  // exceed the database connection/socket budget when the season contains a
  // large number of finished fixtures, causing the score pass to abort before
  // any leaderboard rows are rebuilt. Chunking makes the run retryable and
  // prevents a few older matches from being silently left unscored.
  const predictions: Prediction[] = [];
  const matchIds = matches.map((match) => match.providerMatchId);
  for (let index = 0; index < matchIds.length; index += 100) {
    const batch = await db
      .collection<Prediction>("predictions")
      .find({
        matchId: { $in: matchIds.slice(index, index + 100) },
        userId: { $ne: "guest" },
      })
      .toArray();
    predictions.push(...batch);
  }
  const now = new Date();
  const predictionIds = predictions.map((prediction) => String(prediction._id ?? `${prediction.userId}:${prediction.matchId}`));
  const existingSnapshots: any[] = [];
  for (let index = 0; index < predictionIds.length; index += 100) {
    const batch = await db
      .collection<any>("predictionLockSnapshots")
      .find({ predictionId: { $in: predictionIds.slice(index, index + 100) } })
      .toArray();
    existingSnapshots.push(...batch);
  }
  const existingByPredictionId = new Map(existingSnapshots.map((snapshot) => [String(snapshot.predictionId), snapshot]));
  const snapshots = new Map<
    string,
    Awaited<ReturnType<typeof createLockSnapshot>>
  >();
  for (const prediction of predictions) {
    if (!isPredictionLocked(byMatch.get(prediction.matchId)!)) continue;
    const predictionId = String(prediction._id ?? `${prediction.userId}:${prediction.matchId}`);
    const snapshot = existingByPredictionId.get(predictionId);
    // Scoring must remain bounded even when old predictions predate lock
    // snapshots. Missing historical snapshots are treated as no-club scores;
    // creating them one-by-one here can block the entire scoring transaction.
    if (snapshot)
      snapshots.set(`${prediction.userId}:${prediction.matchId}`, snapshot);
  }
  const clubIds = [
    ...new Set(
      [...snapshots.values()]
        .map((snapshot) => snapshot.clubIdAtLock)
        .filter(Boolean) as string[],
    ),
  ];
  const clubs = clubIds.length
    ? await db
        .collection<any>("clubs")
        .find(
          {
            _id: {
              $in: clubIds
                .filter(ObjectId.isValid)
                .map((id) => new ObjectId(id)),
            },
          },
          { projection: { leaderboardCompetitionCodes: 1 } },
        )
        .toArray()
    : [];
  const clubCompetitionCodes = new Map(
    clubs.map((club) => [
      String(club._id),
      Array.isArray(club.leaderboardCompetitionCodes)
        ? club.leaderboardCompetitionCodes
        : DEFAULT_CLUB_LEAGUE_CODES,
    ]),
  );
  const scoreOps = predictions.map((prediction) => {
    const match = byMatch.get(prediction.matchId)!;
    const globalEligible =
      isGlobalCompetition(match.leagueCode) &&
      (getLeague(match.leagueCode)?.kind !== "INTERNATIONAL" ||
        isFeaturedFixture(
          match.leagueCode,
          match.homeTeam.name,
          match.awayTeam.name,
        ));
    const score = calculatePredictionScore(
      prediction.homeGoals,
      prediction.awayGoals,
      match.homeGoals,
      match.awayGoals,
    );
    const snapshot = snapshots.get(
      `${prediction.userId}:${prediction.matchId}`,
    );
    return {
      updateOne: {
        filter: { userId: prediction.userId, matchId: prediction.matchId },
        update: {
          $set: {
            predictionId: String(
              prediction._id ?? `${prediction.userId}:${prediction.matchId}`,
            ),
            fixtureId: match.providerMatchId,
            matchId: match.providerMatchId,
            userId: prediction.userId,
            leagueCode: match.leagueCode,
            seasonId: String(match.seasonStartYear),
            seasonStartYear: match.seasonStartYear,
            roundId: match.roundId ?? null,
            matchday: match.matchday,
            kickoffAt: match.kickoffAt,
            points: score.points,
            category: score.category,
            exactScore: score.category === "EXACT_SCORE",
            correctOutcome: [
              "EXACT_SCORE",
              "CORRECT_GOAL_DIFFERENCE",
              "CORRECT_OUTCOME",
            ].includes(score.category),
            predictedHomeGoals: prediction.homeGoals,
            predictedAwayGoals: prediction.awayGoals,
            actualHomeGoals: match.homeGoals,
            actualAwayGoals: match.awayGoals,
            predictionCreatedAt: prediction.createdAt ?? null,
            globalEligible,
            clubIdAtLock: snapshot?.clubIdAtLock ?? null,
            scoringVersion: SCORING_VERSION,
            calculatedAt: now,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    };
  });
  const aggregates = new Map<
    string,
    {
      userId: string;
      scope: string;
      points: number;
      predictions: number;
      exact: number;
      correctOutcome: number;
      earliestPredictionAt?: Date;
    }
  >();
  for (const prediction of predictions) {
    const match = byMatch.get(prediction.matchId)!;
    const globalEligible =
      isGlobalCompetition(match.leagueCode) &&
      (getLeague(match.leagueCode)?.kind !== "INTERNATIONAL" ||
        isFeaturedFixture(
          match.leagueCode,
          match.homeTeam.name,
          match.awayTeam.name,
        ));
    const score = calculatePredictionScore(
      prediction.homeGoals,
      prediction.awayGoals,
      match.homeGoals,
      match.awayGoals,
    );
    const snapshot = snapshots.get(
      `${prediction.userId}:${prediction.matchId}`,
    );
    const scopes = [
      `LEAGUE:${match.leagueCode}:${match.seasonStartYear}`,
      `ROUND:${match.leagueCode}:${match.seasonStartYear}:${match.matchday}`,
      `SEASON:${match.seasonStartYear}`,
    ];
    if (globalEligible)
      scopes.push("GLOBAL");
    if (
      snapshot?.clubIdAtLock &&
      (
        clubCompetitionCodes.get(snapshot.clubIdAtLock) ??
        DEFAULT_CLUB_LEAGUE_CODES
      ).includes(match.leagueCode)
    )
      scopes.push(
        `CLUB:${snapshot.clubIdAtLock}:OVERALL:${match.seasonStartYear}`,
        `CLUB:${snapshot.clubIdAtLock}:LEAGUE:${match.leagueCode}:${match.seasonStartYear}`,
        `CLUB:${snapshot.clubIdAtLock}:ROUND:${match.leagueCode}:${match.seasonStartYear}:${match.matchday}`,
      );
    for (const scope of scopes) {
      const key = `${prediction.userId}:${scope}`;
      const row = aggregates.get(key) ?? {
        userId: prediction.userId,
        scope,
        points: 0,
        predictions: 0,
        exact: 0,
        correctOutcome: 0,
      };
      row.points += score.points;
      row.predictions++;
      row.exact += score.category === "EXACT_SCORE" ? 1 : 0;
      row.correctOutcome += [
        "EXACT_SCORE",
        "CORRECT_GOAL_DIFFERENCE",
        "CORRECT_OUTCOME",
      ].includes(score.category)
        ? 1
        : 0;
      if (
        prediction.createdAt &&
        (!row.earliestPredictionAt ||
          prediction.createdAt < row.earliestPredictionAt)
      )
        row.earliestPredictionAt = prediction.createdAt;
      aggregates.set(key, row);
    }
  }
  const touchedUsers = [
    ...new Set([...aggregates.values()].map((row) => row.userId)),
  ];
  const globalPoints = new Map(
    [...aggregates.values()]
      .filter((row) => row.scope === "GLOBAL")
      .map((row) => [row.userId, row.points]),
  );
  const statOps = [...aggregates.values()].map((row) => ({
    updateOne: {
      filter: { userId: row.userId, scope: row.scope },
      update: {
        $set: {
          ...row,
          globalPoints: globalPoints.get(row.userId) ?? 0,
          totalPoints: row.points,
          predictionCount: row.predictions,
          exactScores: row.exact,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  }));
  // Scores and the materialized rows are one consistency unit. This prevents a
  // correction from exposing new scores with old leaderboard totals (or vice
  // versa) during a sync or concurrent request.
  const chunks = <T,>(items: T[], size = 100) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
  await withMongoTransaction(async (transactionDb, session) => {
    for (const chunk of chunks(scoreOps)) await transactionDb.collection("predictionScores").bulkWrite(chunk, { ordered: false, session });
    if (rebuildLeaderboards && touchedUsers.length)
      await transactionDb
        .collection("leaderboardStats")
        .deleteMany({ userId: { $in: touchedUsers } }, { session });
    for (const chunk of rebuildLeaderboards ? chunks(statOps) : []) await transactionDb.collection("leaderboardStats").bulkWrite(chunk, { ordered: false, session });
  });
  if (!rebuildLeaderboards)
    return {
      matches: matches.length,
      scores: scoreOps.length,
      leaderboards: 0,
      touchedUsers,
      awards: null,
    };
  await writeRankSnapshots(
    db,
    [...aggregates.values()].map((row) => ({
      userId: row.userId,
      scope: row.scope,
      points: row.points,
      exact: row.exact,
      correctOutcome: row.correctOutcome,
      predictions: row.predictions,
    })),
    now,
  );
  const roundWinners = await rebuildRoundWinners(db);
  const awards = await grantAutomaticAwards(db);
  return {
    matches: matches.length,
    scores: scoreOps.length,
    leaderboards: aggregates.size,
    touchedUsers,
    roundWinners,
    awards,
  };
}

async function rebuildLeaderboardStatsForUsers(
  db: Awaited<ReturnType<typeof getDb>>,
  userIds: string[],
) {
  const ids = [...new Set(userIds.map(String).filter(Boolean))];
  if (!ids.length) return { leaderboards: 0, scoreRows: 0 };

  const scoreRows = await db
    .collection<any>("predictionScores")
    .find({ userId: { $in: ids } })
    .toArray();
  const clubIds = [
    ...new Set(
      scoreRows
        .map((row) => row.clubIdAtLock)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const clubs = clubIds.length
    ? await db
        .collection<any>("clubs")
        .find(
          {
            _id: {
              $in: clubIds
                .filter(ObjectId.isValid)
                .map((id) => new ObjectId(id)),
            },
          },
          { projection: { leaderboardCompetitionCodes: 1 } },
        )
        .toArray()
    : [];
  const clubCompetitionCodes = new Map(
    clubs.map((club) => [
      String(club._id),
      Array.isArray(club.leaderboardCompetitionCodes)
        ? club.leaderboardCompetitionCodes
        : DEFAULT_CLUB_LEAGUE_CODES,
    ]),
  );
  const aggregates = new Map<string, any>();
  for (const score of scoreRows) {
    const leagueCode = String(score.leagueCode ?? "");
    const seasonStartYear = Number(
      score.seasonStartYear ?? score.seasonId ?? 0,
    );
    const scopes = [
      `LEAGUE:${leagueCode}:${seasonStartYear}`,
      `ROUND:${leagueCode}:${seasonStartYear}:${Number(score.matchday ?? 0)}`,
      `SEASON:${seasonStartYear}`,
    ];
    if (score.globalEligible) scopes.push("GLOBAL");
    const clubId = score.clubIdAtLock ? String(score.clubIdAtLock) : null;
    if (
      clubId &&
      (
        clubCompetitionCodes.get(clubId) ?? DEFAULT_CLUB_LEAGUE_CODES
      ).includes(leagueCode)
    ) {
      scopes.push(
        `CLUB:${clubId}:OVERALL:${seasonStartYear}`,
        `CLUB:${clubId}:LEAGUE:${leagueCode}:${seasonStartYear}`,
        `CLUB:${clubId}:ROUND:${leagueCode}:${seasonStartYear}:${Number(score.matchday ?? 0)}`,
      );
    }
    for (const scope of scopes) {
      const key = `${String(score.userId)}:${scope}`;
      const row = aggregates.get(key) ?? {
        userId: String(score.userId),
        scope,
        points: 0,
        predictions: 0,
        exact: 0,
        correctOutcome: 0,
        earliestPredictionAt: undefined,
      };
      row.points += Number(score.points ?? 0);
      row.predictions += 1;
      row.exact += score.exactScore ? 1 : 0;
      row.correctOutcome += score.correctOutcome ? 1 : 0;
      const predictionCreatedAt = score.predictionCreatedAt
        ? new Date(score.predictionCreatedAt)
        : null;
      if (
        predictionCreatedAt &&
        !Number.isNaN(predictionCreatedAt.getTime()) &&
        (!row.earliestPredictionAt ||
          predictionCreatedAt < row.earliestPredictionAt)
      )
        row.earliestPredictionAt = predictionCreatedAt;
      aggregates.set(key, row);
    }
  }
  const globalPoints = new Map(
    [...aggregates.values()]
      .filter((row) => row.scope === "GLOBAL")
      .map((row) => [row.userId, row.points]),
  );
  const now = new Date();
  const statOps = [...aggregates.values()].map((row) => ({
    updateOne: {
      filter: { userId: row.userId, scope: row.scope },
      update: {
        $set: {
          ...row,
          globalPoints: globalPoints.get(row.userId) ?? 0,
          totalPoints: row.points,
          predictionCount: row.predictions,
          exactScores: row.exact,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  }));
  const chunks = <T,>(items: T[], size = 100) =>
    Array.from(
      { length: Math.ceil(items.length / size) },
      (_, index) => items.slice(index * size, (index + 1) * size),
    );
  await withMongoTransaction(async (transactionDb, session) => {
    await transactionDb
      .collection("leaderboardStats")
      .deleteMany({ userId: { $in: ids } }, { session });
    for (const chunk of chunks(statOps))
      await transactionDb
        .collection("leaderboardStats")
        .bulkWrite(chunk, { ordered: false, session });
  });
  await writeRankSnapshots(
    db,
    [...aggregates.values()].map((row) => ({
      userId: row.userId,
      scope: row.scope,
      points: row.points,
      exact: row.exact,
      correctOutcome: row.correctOutcome,
      predictions: row.predictions,
    })),
    now,
  );
  return { leaderboards: aggregates.size, scoreRows: scoreRows.length };
}

export async function runLeaderboardEngine(
  options: {
    recentOnly?: boolean;
    batchIndex?: number;
    batchSize?: number;
  } = {},
) {
  if (!options.recentOnly) return runScoreEngine({ rebuildLeaderboards: true });

  const db = await getDb();
  // Recovery is for newly finished fixtures, not every old fixture touched by
  // the weekly discovery refresh. Limiting by kickoff date keeps the cron
  // bounded and prevents a historical re-sync from creating dozens of jobs.
  const since = new Date(Date.now() - 3 * 86_400_000);
  const recentMatches = await db
    .collection<any>("matches")
    .find(
      {
        provider: { $in: ["football-api", "sportsapi"] },
        status: "FINISHED",
        homeGoals: { $ne: null },
        awayGoals: { $ne: null },
        kickoffAt: { $gte: since },
      },
      { projection: { providerMatchId: 1 } },
    )
    .limit(5000)
    .toArray();
  const batchSize = Math.max(1, options.batchSize ?? 5);
  const batchIndex = Math.max(0, options.batchIndex ?? 0);
  const batch = recentMatches.slice(
    batchIndex * batchSize,
    (batchIndex + 1) * batchSize,
  );
  const scored = await runScoreEngine({
    rebuildLeaderboards: false,
    matchIds: batch.map((match) => String(match.providerMatchId)),
  });
  const rebuilt = await rebuildLeaderboardStatsForUsers(
    db,
    scored.touchedUsers ?? [],
  );
  return {
    ...scored,
    leaderboards: rebuilt.leaderboards,
    roundWinners: 0,
    awards: null,
    recoveryMode: "recent-three-days",
    batchIndex,
    batchSize,
    totalBatches: Math.ceil(recentMatches.length / batchSize),
    hasMore: (batchIndex + 1) * batchSize < recentMatches.length,
  };
}
