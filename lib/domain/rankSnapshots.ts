import type { Db } from "mongodb";

export type SnapshotRank = { userId: string; rank: number };

export function snapshotScope(scope: {
  clubId?: string | null;
  seasonStartYear?: number | null;
  weekly?: boolean;
  weeklyOffset?: number;
  leagueCode?: string | null;
  matchday?: number | null;
}) {
  if (scope.clubId)
    return scope.leagueCode
      ? `CLUB:${scope.clubId}:LEAGUE:${scope.leagueCode}:${scope.seasonStartYear}`
      : `CLUB:${scope.clubId}:OVERALL:${scope.seasonStartYear}`;
  if (scope.weekly) return `WEEKLY:${scope.weeklyOffset ?? 0}`;
  if (scope.leagueCode)
    return scope.matchday != null
      ? `ROUND:${scope.leagueCode}:${scope.seasonStartYear}:${scope.matchday}`
      : `LEAGUE:${scope.leagueCode}:${scope.seasonStartYear}`;
  return scope.seasonStartYear != null
    ? `SEASON:${scope.seasonStartYear}`
    : "GLOBAL";
}

export function snapshotDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getSnapshotRanks(db: Db, scope: string, date: Date) {
  const snapshot = await db
    .collection<{ rows?: SnapshotRank[] }>("rankSnapshots")
    .findOne(
      { scope, dayKey: snapshotDayKey(date) },
      { projection: { rows: 1 } },
    );
  return new Map((snapshot?.rows ?? []).map((row) => [row.userId, row.rank]));
}

export async function writeRankSnapshots(
  db: Db,
  rows: Array<{
    userId: string;
    scope: string;
    points: number;
    exact: number;
    correctOutcome: number;
    predictions: number;
  }>,
  date = new Date(),
) {
  const grouped = new Map<string, typeof rows>();
  for (const row of rows)
    grouped.set(row.scope, [...(grouped.get(row.scope) ?? []), row]);
  const operations = [...grouped.entries()].map(([scope, values]) => {
    const ordered = [...values].sort(
      (a, b) =>
        b.points - a.points ||
        b.exact - a.exact ||
        b.correctOutcome - a.correctOutcome ||
        b.predictions - a.predictions ||
        a.userId.localeCompare(b.userId),
    );
    return {
      updateOne: {
        filter: { scope, dayKey: snapshotDayKey(date) },
        update: {
          $set: {
            scope,
            dayKey: snapshotDayKey(date),
            rows: ordered
              .slice(0, 1000)
              .map((row, index) => ({ userId: row.userId, rank: index + 1 })),
            updatedAt: date,
          },
        },
        upsert: true,
      },
    };
  });
  if (operations.length)
    await db
      .collection("rankSnapshots")
      .bulkWrite(operations, { ordered: false });
}
