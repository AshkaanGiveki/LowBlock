export type Rankable = { points: number; exact: number; predictions: number; correctOutcome?: number; globalPoints?: number; earliestPredictionAt?: number; userId: string; username?: string };

/** One tie-break policy used by global, league, round, and Club standings. */
export function compareRank(a: Rankable, b: Rankable) {
  return b.points - a.points || b.exact - a.exact || (b.correctOutcome ?? 0) - (a.correctOutcome ?? 0) || (b.globalPoints ?? 0) - (a.globalPoints ?? 0) || (a.earliestPredictionAt ?? Number.MAX_SAFE_INTEGER) - (b.earliestPredictionAt ?? Number.MAX_SAFE_INTEGER) || b.predictions - a.predictions || String(a.userId).localeCompare(String(b.userId));
}

export function rankRows<T extends Rankable>(rows: T[]) {
  const sorted = [...rows].sort(compareRank);
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}
