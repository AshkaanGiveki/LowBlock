import type { Db } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { appDateKey } from "@/lib/football/scheduleWindow";
import { ensureCurrentH2HLeagues, getH2HWeek, isH2HEnabled, refreshActiveH2HResults } from "@/lib/domain/h2h";
import { scheduleFootballNotifications } from "@/lib/notifications/scheduling";
import { processLocalNotificationJobs, localNotificationQueueStatus } from "@/lib/notifications/localQueue";
import { runDailyFootballCycle } from "./dailyCycle";
import { isDailyWorkerWindow, localWorkerClock } from "./schedule";

const DAILY_LEASE_MS = 90 * 60_000;

async function claimRun(db: Db, runKey: string) {
  const now = new Date();
  try {
    const result = await db.collection("workerRuns").updateOne(
      {
        runKey,
        $or: [
          { status: { $exists: false } },
          { status: "FAILED" },
          { status: "RUNNING", leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { status: "RUNNING", startedAt: now, updatedAt: now, leaseUntil: new Date(now.getTime() + DAILY_LEASE_MS) },
        $setOnInsert: { runKey, createdAt: now },
      },
      { upsert: true },
    );
    return result.upsertedCount === 1 || result.modifiedCount === 1;
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function finishRun(db: Db, runKey: string, status: "DONE" | "FAILED", result?: unknown, error?: unknown) {
  await db.collection("workerRuns").updateOne(
    { runKey, status: "RUNNING" },
    {
      $set: {
        status,
        result,
        error: error instanceof Error ? error.message : error ? String(error) : undefined,
        finishedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: { leaseUntil: "" },
    },
  );
}

export async function runH2HCycle() {
  if (!isH2HEnabled()) return { enabled: false };
  const db = await getDb();
  const tomorrow = appDateKey(new Date(Date.now() + 86_400_000));
  const schedule = await ensureCurrentH2HLeagues(db, { sourceDate: tomorrow, batchIndex: 0, batchSize: 1000 });
  const results = await refreshActiveH2HResults(db, getH2HWeek().key);
  return { enabled: true, tomorrow, schedule, results };
}

export async function runWorkerCycle() {
  let notifications = null;
  let notificationSchedulingError: string | null = null;
  try {
    notifications = await scheduleFootballNotifications();
  } catch (error) {
    notificationSchedulingError = error instanceof Error ? error.message : String(error);
    console.error("local_notification_scheduling_failed", { error: notificationSchedulingError });
  }
  let jobs = null;
  let notificationProcessingError: string | null = null;
  try {
    jobs = await processLocalNotificationJobs({ limit: 50 });
  } catch (error) {
    notificationProcessingError = error instanceof Error ? error.message : String(error);
    console.error("local_notification_processing_failed", { error: notificationProcessingError });
  }
  const clock = localWorkerClock();
  const today = clock.dateKey || appDateKey();
  let daily = null;
  let h2h = null;
  if (isDailyWorkerWindow()) {
    const db = await getDb();
    const dailyRunKey = `daily-football:${today}`;
    if (await claimRun(db, dailyRunKey)) {
      try {
        daily = await runDailyFootballCycle();
        await finishRun(db, dailyRunKey, "DONE", { daily });
      } catch (error) {
        await finishRun(db, dailyRunKey, "FAILED", undefined, error);
        console.error("local_daily_cycle_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const h2hRunKey = `h2h:${today}`;
    if (await claimRun(db, h2hRunKey)) {
      try {
        h2h = await runH2HCycle();
        await finishRun(db, h2hRunKey, "DONE", { h2h });
      } catch (error) {
        await finishRun(db, h2hRunKey, "FAILED", undefined, error);
        console.error("local_h2h_cycle_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return {
    notifications,
    jobs,
    daily,
    h2h,
    errors: {
      notificationSchedulingError,
      notificationProcessingError,
    },
  };
}

export async function workerStatus() {
  const db = await getDb();
  const latestRun = await db.collection("workerRuns").findOne({}, { sort: { updatedAt: -1 } });
  const latestSync = await db.collection("syncRuns").findOne({}, { sort: { startedAt: -1 } });
  const requestSince = new Date(Date.now() - 24 * 60 * 60_000);
  return {
    notificationsEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN || process.env.BALE_BOT_TOKEN),
    latestRun,
    latestSync,
    notificationJobs: await localNotificationQueueStatus(),
    sportsApiRequestsLast24h: await db.collection("sportsApiRequests").countDocuments({
      timestamp: { $gte: requestSince },
    }),
    sportsApiRequestBudget: Number(process.env.SPORTSAPI_DAILY_REQUEST_BUDGET || 10),
    latestSportsApiRequest: await db.collection("sportsApiRequests").findOne({}, { sort: { timestamp: -1 } }),
  };
}
