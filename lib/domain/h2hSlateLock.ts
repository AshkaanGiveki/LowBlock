import type { Db } from "mongodb";

/**
 * H2H slates are immutable after first publication, including before kickoff.
 * A normal cron, Telegram "Sync now", retry or hosted GitHub sync may append
 * an unpublished matchday, but can NEVER replace an already published slate.
 *
 * The server-side Mongo predicate makes this safe even when two independent
 * sync workers race to publish the same date.
 */
export async function publishH2HSlateOnce<TSlate extends { sourceDate: string; matchday: number }>(
  db: Db,
  league: { _id: unknown; slates?: TSlate[] },
  candidate: TSlate,
): Promise<{ league: typeof league; action: "PUBLISHED" | "ALREADY_PUBLISHED" }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.sourceDate) ||
      !Number.isInteger(candidate.matchday) ||
      candidate.matchday < 1 || candidate.matchday > 7) {
    throw new Error("INVALID_H2H_SLATE");
  }
  const existing = (league.slates ?? []).find(
    (slate) => slate.sourceDate === candidate.sourceDate || slate.matchday === candidate.matchday,
  );
  if (existing) return { league, action: "ALREADY_PUBLISHED" };

  const collection = db.collection<{ _id: any; status: string; slates: TSlate[]; updatedAt?: Date }>("h2hLeagues");
  const published = await collection.findOneAndUpdate(
    {
      _id: league._id,
      status: "ACTIVE",
      "slates.sourceDate": { $ne: candidate.sourceDate },
      "slates.matchday": { $ne: candidate.matchday },
    },
    { $push: { slates: candidate }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (published) return { league: published, action: "PUBLISHED" };

  // Re-read after a concurrent publisher won. Do not retry with $set or
  // replace an existing fixture array, under any circumstance.
  const latest = await collection.findOne({ _id: league._id });
  if (!latest) throw new Error("H2H_LEAGUE_DISAPPEARED");
  const nowPublished = (latest.slates ?? []).some(
    (slate: TSlate) => slate.sourceDate === candidate.sourceDate || slate.matchday === candidate.matchday,
  );
  if (!nowPublished) throw new Error("H2H_SLATE_PUBLISH_REJECTED");
  return { league: latest, action: "ALREADY_PUBLISHED" };
}
