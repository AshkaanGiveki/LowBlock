export type ScoredPredictionComparable = {
  scoringVersion?: string | number | null;
  points?: number | null;
  category?: string | null;
  predictedHomeGoals?: number | null;
  predictedAwayGoals?: number | null;
  actualHomeGoals?: number | null;
  actualAwayGoals?: number | null;
  globalEligible?: boolean | null;
  clubIdAtLock?: string | null;
  leagueCode?: string | null;
  seasonStartYear?: number | null;
  matchday?: number | null;
  roundId?: string | null;
  kickoffAt?: Date | string | null;
  predictionCreatedAt?: Date | string | null;
};

function dateValue(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : NaN;
}

/**
 * The deterministic skip gate for nightly scoring. Persisted metadata matters
 * even when points are unchanged (for example a changed fixture round).
 */
export function hasScoredPredictionChanged(
  previous: ScoredPredictionComparable | null | undefined,
  next: ScoredPredictionComparable,
): boolean {
  if (!previous) return true;
  const numeric: Array<keyof ScoredPredictionComparable> = [
    "points", "predictedHomeGoals", "predictedAwayGoals",
    "actualHomeGoals", "actualAwayGoals", "seasonStartYear", "matchday",
  ];
  if (numeric.some((key) => Number(previous[key]) !== Number(next[key]))) return true;
  if (String(previous.scoringVersion ?? "") !== String(next.scoringVersion ?? "")) return true;
  if ((previous.category ?? null) !== (next.category ?? null)) return true;
  if (Boolean(previous.globalEligible) !== Boolean(next.globalEligible)) return true;
  if ((previous.clubIdAtLock ?? null) !== (next.clubIdAtLock ?? null)) return true;
  if ((previous.leagueCode ?? null) !== (next.leagueCode ?? null)) return true;
  if ((previous.roundId ?? null) !== (next.roundId ?? null)) return true;
  if (!Object.is(dateValue(previous.kickoffAt), dateValue(next.kickoffAt))) return true;
  if (!Object.is(dateValue(previous.predictionCreatedAt), dateValue(next.predictionCreatedAt))) return true;
  return false;
}
