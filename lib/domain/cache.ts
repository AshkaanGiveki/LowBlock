import { revalidateTag } from "next/cache";
export function invalidateCompetitionCaches() { for (const tag of ["matches", "leaderboards", "profiles", "rounds", "club-memberships"]) revalidateTag(tag); }
