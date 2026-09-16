import { revalidateTag } from "next/cache";
export function invalidateCompetitionCaches() {
  for (const tag of [
    "matches",
    "match-results",
    "leaderboards",
    "leaderboard-summary",
    "profiles",
    "rounds",
    "clubs",
    "club-memberships",
    "tournaments",
    "seasons",
  ])
    revalidateTag(tag);
}
export function competitionTag(
  kind: "match" | "result" | "leaderboard" | "league" | "club",
  id?: string,
) {
  return id ? `lowblock:${kind}:${id}` : `lowblock:${kind}`;
}
