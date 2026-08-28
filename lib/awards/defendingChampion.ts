import type { Db } from "mongodb";
import { LOWBLOCK_SCOPE, WEEKLY_WINNER_TYPE } from "@/lib/awards/config";

export async function getDefendingChampionUserId(db: Db) {
  const award = await db.collection<{ userId?: string }>("awards").findOne(
    { type: WEEKLY_WINNER_TYPE, scope: LOWBLOCK_SCOPE },
    { sort: { awardedAt: -1 }, projection: { userId: 1 } },
  );
  return award?.userId ?? null;
}
