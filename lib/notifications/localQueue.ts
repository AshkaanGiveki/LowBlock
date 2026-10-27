import type { Db } from "mongodb";
import { getDb } from "@/lib/db/mongo";

export type LocalNotificationJobType =
  | "MATCH_REMINDER"
  | "CHANNEL_FIRST_MATCH"
  | "CHANNEL_MATCHES"
  | "CHANNEL_LEADERBOARD";

export type LocalNotificationJob = {
  _id?: unknown;
  jobKey: string;
  type: LocalNotificationJobType;
  runAt: Date;
  payload: Record<string, unknown>;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "DEAD";
  attempts: number;
  leaseUntil?: Date;
  lastError?: string;
};

const LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 8;

export async function enqueueLocalNotificationJob(
  db: Db,
  input: Pick<LocalNotificationJob, "jobKey" | "type" | "runAt" | "payload">,
) {
  const now = new Date();
  try {
    const result = await db.collection("notificationJobs").updateOne(
      { jobKey: input.jobKey },
      {
        $setOnInsert: {
          ...input,
          status: "PENDING",
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    return result.upsertedCount === 1;
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function claimNextJob(db: Db): Promise<LocalNotificationJob | null> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  const result = await db.collection<LocalNotificationJob>("notificationJobs").findOneAndUpdate(
    {
      $or: [
        { status: "PENDING", runAt: { $lte: now } },
        { status: "FAILED", runAt: { $lte: now }, attempts: { $lt: MAX_ATTEMPTS } },
        { status: "PROCESSING", leaseUntil: { $lte: now }, attempts: { $lt: MAX_ATTEMPTS } },
      ],
    },
    {
      $set: { status: "PROCESSING", leaseUntil, updatedAt: now },
      $inc: { attempts: 1 },
    },
    { sort: { runAt: 1, createdAt: 1 }, returnDocument: "after" },
  );
  return result ?? null;
}

async function markJobDone(db: Db, job: LocalNotificationJob) {
  await db.collection("notificationJobs").updateOne(
    { jobKey: job.jobKey, status: "PROCESSING" },
    { $set: { status: "DONE", updatedAt: new Date() }, $unset: { leaseUntil: "", lastError: "" } },
  );
}

async function markJobFailed(db: Db, job: LocalNotificationJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const dead = job.attempts >= MAX_ATTEMPTS;
  const retryAt = new Date(Date.now() + Math.min(30 * 60_000, 15_000 * 2 ** Math.max(0, job.attempts - 1)));
  await db.collection("notificationJobs").updateOne(
    { jobKey: job.jobKey, status: "PROCESSING" },
    {
      $set: {
        status: dead ? "DEAD" : "FAILED",
        runAt: retryAt,
        lastError: message.slice(0, 2000),
        updatedAt: new Date(),
      },
      $unset: { leaseUntil: "" },
    },
  );
}

async function executeJob(db: Db, job: LocalNotificationJob) {
  switch (job.type) {
    case "MATCH_REMINDER": {
      const { processMatchReminder } = await import("./reminders");
      return processMatchReminder(String(job.payload.matchId));
    }
    case "CHANNEL_FIRST_MATCH": {
      const { publishFirstMatchChannelReminder } = await import("./channel");
      return publishFirstMatchChannelReminder(
        db,
        String(job.payload.dateKey),
        String(job.payload.matchId),
      );
    }
    case "CHANNEL_MATCHES": {
      const { publishChannelMatches } = await import("./channel");
      return publishChannelMatches(db, new Date(`${String(job.payload.dateKey)}T00:00:00.000Z`));
    }
    case "CHANNEL_LEADERBOARD": {
      const { publishChannelLeaderboard } = await import("./channel");
      return publishChannelLeaderboard(db, new Date(`${String(job.payload.dateKey)}T00:00:00.000Z`));
    }
  }
}

export async function processLocalNotificationJobs(options: { limit?: number } = {}) {
  const db = await getDb();
  const limit = Math.max(1, Math.min(100, options.limit ?? 25));
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  for (; processed < limit; processed++) {
    const job = await claimNextJob(db);
    if (!job) break;
    try {
      await executeJob(db, job);
      await markJobDone(db, job);
      succeeded++;
    } catch (error) {
      failed++;
      await markJobFailed(db, job, error);
      console.error("local_notification_job_failed", {
        jobKey: job.jobKey,
        type: job.type,
        attempts: job.attempts,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { processed, succeeded, failed };
}

export async function localNotificationQueueStatus() {
  const db = await getDb();
  const rows = await db.collection("notificationJobs").aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}
