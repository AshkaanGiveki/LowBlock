export type MatchTab = "open" | "live" | "started";

/** Kick-off closes predictions; only a confirmed final status is a result. */
export function matchTabFor(
  match: { status: string; kickoffAt: Date | string },
  now = Date.now(),
): MatchTab | null {
  if (["VOID", "CANCELLED", "POSTPONED"].includes(match.status)) return null;
  if (match.status === "FINISHED") return "started";
  if (["LIVE", "SUSPENDED"].includes(match.status)) return "live";
  if (match.status === "SCHEDULED") {
    const kickoff = new Date(match.kickoffAt).getTime();
    if (!Number.isFinite(kickoff)) return null;
    return kickoff > now ? "open" : "live";
  }
  return null;
}
