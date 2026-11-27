import { appDateKey, appLocalDateTimeToUtc } from "@/lib/football/scheduleWindow";

export type LeaderboardPeriod = { start: Date; end: Date };

/**
 * Weekly rankings use Friday 00:00 in the configured APP_TIMEZONE
 * (Asia/Tehran in production), not Friday 00:00 UTC.
 * Fixtures belong to the week of KICKOFF, independent of when settled.
 */
export function getIranWeeklyPeriod(
  now = new Date(),
  weekOffset = 0,
): LeaderboardPeriod {
  const localDate = appDateKey(now);
  const localMidnight = new Date(`${localDate}T00:00:00.000Z`);
  const daysSinceFriday = (localMidnight.getUTCDay() + 2) % 7;
  localMidnight.setUTCDate(localMidnight.getUTCDate() - daysSinceFriday - 7 * weekOffset);
  const startKey = localMidnight.toISOString().slice(0, 10);
  localMidnight.setUTCDate(localMidnight.getUTCDate() + 7);
  const endKey = localMidnight.toISOString().slice(0, 10);
  return {
    start: appLocalDateTimeToUtc(startKey, 0),
    end: appLocalDateTimeToUtc(endKey, 0),
  };
}
