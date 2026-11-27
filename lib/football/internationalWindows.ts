/**
 * Verified men's FIFA international release windows. Unmapped senior national
 * fixtures must not be surfaced merely because they contain a famous team.
 *
 * Update this schedule from FIFA's calendar before a new season. Other
 * explicitly mapped competitions (Nations League, continental finals etc.)
 * remain governed by their own competition mapping and are not restricted here.
 */
export const MEN_2026_FIFA_WINDOWS = [
  ["2026-03-23", "2026-03-31"],
  ["2026-06-01", "2026-06-09"],
  ["2026-09-21", "2026-10-06"],
  ["2026-11-09", "2026-11-17"],
] as const;

export function isVerifiedSeniorFriendlyDate(value: Date | string): boolean {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const key = date.toISOString().slice(0, 10);
  return MEN_2026_FIFA_WINDOWS.some(([start, end]) => key >= start && key <= end);
}

export function isSeniorFriendlyAllowedForMatch(
  leagueCode: string,
  kickoffAt: Date | string,
): boolean {
  if (leagueCode !== "FRIENDLY" && leagueCode !== "INTL_OTHER") return true;
  return isVerifiedSeniorFriendlyDate(kickoffAt);
}

/**
 * Gate already-imported records at the match-list query layer. That prevents
 * a stale provider response from reintroducing a questionable fixture.
 */
export function unverifiedSeniorFriendlyRanges(
  start: Date,
  end: Date,
): Array<{ start: Date; end: Date }> {
  // Partition UTC days so a request crossing the window's final day doesn't
  // accidentally hide valid friendlies before the exact boundary.
  const ranges: Array<{ start: Date; end: Date }> = [];
  const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  while (day < end) {
    const next = new Date(day.getTime() + 86_400_000);
    if (!isVerifiedSeniorFriendlyDate(day)) {
      const lower = new Date(Math.max(start.getTime(), day.getTime()));
      const upper = new Date(Math.min(end.getTime(), next.getTime()));
      if (lower < upper) ranges.push({ start: lower, end: upper });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return ranges;
}
