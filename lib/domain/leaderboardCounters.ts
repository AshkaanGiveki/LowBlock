import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/mongo";

/** Informational counters; they should not issue collection counts per page view. */
export const getCachedLeaderboardCounters = unstable_cache(async () => {
  const db = await getDb();
  const [usersCount, picksCount, roundsCount] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("predictions").countDocuments({ userId: { $ne: "guest" } }),
    db.collection("rounds").countDocuments({ status: "FINAL" }),
  ]);
  return { usersCount, picksCount, roundsCount };
}, ["lowblock-leaderboard-counters-v1"], { revalidate: 120 });
