const LIVE_STATUSES = new Set(["LIVE", "IN_PLAY", "1H", "2H", "HT", "ET", "PEN", "PAUSED"]);
const FINISHED_STATUSES = new Set(["FINISHED", "FT", "AET"]);
const STARTED_STATUSES = new Set(["SUSPENDED"]);

export function matchDisplayState(
  match: { status?: string | null; kickoffAt?: string | Date | null },
  now: number,
) {
  const status = String(match.status ?? "SCHEDULED").toUpperCase();
  const live = LIVE_STATUSES.has(status);
  const finished = FINISHED_STATUSES.has(status);
  const kickoff = match.kickoffAt ? new Date(match.kickoffAt).getTime() : NaN;
  const alreadyStarted = status === "SCHEDULED" && Number.isFinite(kickoff) && now >= kickoff;
  return {
    live, finished,
    started: live || finished || STARTED_STATUSES.has(status) || alreadyStarted,
  };
}
