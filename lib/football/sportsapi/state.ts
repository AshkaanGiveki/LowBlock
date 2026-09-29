import type { CanonicalMatch } from "../types";

/**
 * State reconciler for merging SportsAPI partial websocket updates into the canonical match state.
 */
export function applyDeltaUpdate(current: CanonicalMatch, delta: any): CanonicalMatch {
  // Create a shallow clone to avoid mutating the original directly
  const updated = { ...current, updatedAt: new Date() };

  // Track the change timestamp for deduplication
  if (delta.changes?.changeTimestamp) {
    if (
      updated.lastChangeTimestamp &&
      delta.changes.changeTimestamp < updated.lastChangeTimestamp
    ) {
      // Delta is older than current state, skip
      return current;
    }
    updated.lastChangeTimestamp = delta.changes.changeTimestamp;
  }

  // Merge partial fields dynamically if present
  if (delta.status) {
    // Status updates
    const type = delta.status.type?.toLowerCase();
    const desc = delta.status.description?.toUpperCase();

    if (type === "finished" || desc === "AWARDED" || desc === "WO") updated.status = "FINISHED";
    else if (type === "inprogress") updated.status = "LIVE";
    else if (type === "postponed" || desc === "POSTPONED") updated.status = "POSTPONED";
    else if (type === "canceled" || desc === "CANCELED" || desc === "CANCELLED") updated.status = "VOID";
    else if (type === "suspended" || desc === "SUSPENDED") updated.status = "SUSPENDED";
  }

  // Update scores if provided
  if (delta.homeScore) {
    updated.homeScore = { ...updated.homeScore, ...delta.homeScore };
    const bestGoal = updated.homeScore?.display ?? updated.homeScore?.current ?? updated.homeScore?.normaltime;
    if (typeof bestGoal === "number") updated.homeGoals = bestGoal;
  }

  if (delta.awayScore) {
    updated.awayScore = { ...updated.awayScore, ...delta.awayScore };
    const bestGoal = updated.awayScore?.display ?? updated.awayScore?.current ?? updated.awayScore?.normaltime;
    if (typeof bestGoal === "number") updated.awayGoals = bestGoal;
  }

  // Elapsed time updates
  if (delta.time?.currentPeriodStartTimestamp) {
    updated.elapsed = Math.floor((Date.now() / 1000 - delta.time.currentPeriodStartTimestamp) / 60);
  }

  return updated;
}
