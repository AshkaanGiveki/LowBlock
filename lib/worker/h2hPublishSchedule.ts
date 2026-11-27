/**
 * SuperLeague publishing is independent of the football provider's daily
 * sync and must check promptly when the Friday noon H2H week changes.
 */
export function shouldRunH2HPublication({
  nowMs,
  currentWeekKey,
  lastAttemptAt,
  lastSuccessfulWeekKey,
  lastAttemptFailed,
}: {
  nowMs: number;
  currentWeekKey: string;
  lastAttemptAt: number;
  lastSuccessfulWeekKey: string;
  lastAttemptFailed: boolean;
}): boolean {
  if (!lastAttemptAt) return true;
  const elapsed = Math.max(0, nowMs - lastAttemptAt);
  if (currentWeekKey !== lastSuccessfulWeekKey && elapsed >= 60_000) return true;
  return elapsed >= (lastAttemptFailed ? 5 * 60_000 : 15 * 60_000);
}
