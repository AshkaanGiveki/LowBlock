/**
 * A not-yet-created SuperLeague week is a valid transitional state, not an
 * HTTP failure. Only requests that really failed can display a retry.
 */
export type SuperLeagueDetailState = "loading" | "ready" | "preparing" | "unavailable" | "no-group";

export function getSuperLeagueDetailState({
  loading,
  failed,
  league,
  selectedWeek,
  currentWeek,
}: {
  loading: boolean;
  failed: boolean;
  league: unknown;
  selectedWeek: string;
  currentWeek: string;
}): SuperLeagueDetailState {
  if (league) return "ready";
  if (loading) return "loading";
  if (failed) return "unavailable";
  return selectedWeek === currentWeek ? "preparing" : "no-group";
}

export function selectSuperLeagueWeek(
  availableWeeks: string[],
  currentWeek: string,
  previousSelection?: string,
): { weeks: string[]; selected: string; index: number } {
  const weeks = [...new Set([...availableWeeks, currentWeek].filter(Boolean))].sort();
  const selected = previousSelection && weeks.includes(previousSelection)
    ? previousSelection
    : weeks.includes(currentWeek) ? currentWeek : weeks.at(-1) ?? "";
  return { weeks, selected, index: Math.max(0, weeks.indexOf(selected)) };
}
