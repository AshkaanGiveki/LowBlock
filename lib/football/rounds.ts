export const DEFAULT_ROUND_GAP_MINUTES = 48 * 60;
export type RoundFixture = { matchday: number; kickoffAt: Date };

export type ActiveRoundCandidate = {
  number: number;
  live?: boolean;
  completed?: boolean;
  nextKickoffAt?: number | null;
};

/**
 * Selects the round users should see as active.
 *
 * Provider round status alone is not enough: a postponed fixture can leave an
 * old round pending forever, while a later round can already be in progress.
 * Live fixtures win; otherwise the round with the earliest future scheduled
 * fixture wins. This also prevents stale partial round records from winning.
 */
export function selectActiveRound(
  rounds: ActiveRoundCandidate[],
  now = Date.now(),
): number | undefined {
  const live = rounds
    .filter((round) => round.live && !round.completed)
    .sort((a, b) => a.number - b.number)[0];
  if (live) return live.number;

  const upcoming = rounds
    .filter(
      (round) =>
        !round.completed &&
        round.nextKickoffAt != null &&
        round.nextKickoffAt >= now,
    )
    .sort(
      (a, b) =>
        (a.nextKickoffAt ?? Number.POSITIVE_INFINITY) -
          (b.nextKickoffAt ?? Number.POSITIVE_INFINITY) ||
        a.number - b.number,
    )[0];
  if (upcoming) return upcoming.number;

  return rounds.filter((round) => round.completed).at(-1)?.number ??
    rounds.at(-1)?.number;
}

/** A Transfermarkt matchday is the source round. Fixtures too far from that round's anchor are hidden. */
export function includeInRound(
  fixture: RoundFixture,
  anchorKickoff: Date,
  maxGapMinutes = DEFAULT_ROUND_GAP_MINUTES,
) {
  return (
    Math.abs(fixture.kickoffAt.getTime() - anchorKickoff.getTime()) <=
    maxGapMinutes * 60_000
  );
}
export function visibleRoundFixtures<T extends RoundFixture>(
  fixtures: T[],
  maxGapMinutes = DEFAULT_ROUND_GAP_MINUTES,
) {
  if (!fixtures.length) return [];
  const sorted = [...fixtures].sort(
    (a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime(),
  );
  const anchor = sorted[0].kickoffAt;
  return sorted.filter((f) => includeInRound(f, anchor, maxGapMinutes));
}
