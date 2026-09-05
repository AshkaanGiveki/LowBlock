export type LeaderboardPeriod = { start: Date; end: Date };

export function getIranWeeklyPeriod(now = new Date(), weekOffset = 0): LeaderboardPeriod {
  const day = now.getUTCDay();
  const daysSinceFriday = (day - 5 + 7) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceFriday - weekOffset * 7));
  return { start, end: new Date(start.getTime() + 7 * 86400000) };
}
