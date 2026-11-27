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
export function excludedUnverifiedFriendliesForWindow(
  start: Date,
  end: Date,
): boolean {
  // All dates in the current request window must be verified, otherwise
  // conservative filtering applies. This can only hide (never invent) matches.
  const day = new Date(start);
  while (day < end) {
    if (!isVerifiedSeniorFriendlyDate(day)) return true;
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return false;
}
