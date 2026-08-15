export const DEFAULT_ROUND_GAP_MINUTES = 48 * 60;
export type RoundFixture = { matchday:number; kickoffAt:Date };
/** A Transfermarkt matchday is the source round. Fixtures too far from that round's anchor are hidden. */
export function includeInRound(fixture:RoundFixture, anchorKickoff:Date, maxGapMinutes=DEFAULT_ROUND_GAP_MINUTES){ return Math.abs(fixture.kickoffAt.getTime()-anchorKickoff.getTime()) <= maxGapMinutes*60_000; }
export function visibleRoundFixtures<T extends RoundFixture>(fixtures:T[], maxGapMinutes=DEFAULT_ROUND_GAP_MINUTES){ if(!fixtures.length)return []; const sorted=[...fixtures].sort((a,b)=>a.kickoffAt.getTime()-b.kickoffAt.getTime()); const anchor=sorted[0].kickoffAt; return sorted.filter(f=>includeInRound(f,anchor,maxGapMinutes)); }
