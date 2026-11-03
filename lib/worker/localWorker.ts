import type { Db } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { appDateKey } from "@/lib/football/scheduleWindow";
import { ensureCurrentH2HLeagues, getH2HWeek, isH2HEnabled, refreshActiveH2HResults } from "@/lib/domain/h2h";
import { scheduleFootballNotifications } from "@/lib/notifications/scheduling";
import { processLocalNotificationJobs, localNotificationQueueStatus } from "@/lib/notifications/localQueue";
import { runCompleteDailyFootballCycle } from "./dailyRecovery";
import { isDailyWorkerWindow, localWorkerClock } from "./schedule";
import { downloadMissingTeamLogos } from "@/lib/football/teamLogos";

const DAILY_LEASE_MS = 90 * 60_000;
let lastTeamLogoSyncAt = 0;

async function claimRun(db: Db, runKey: string) {
  const now = new Date();
  try {
    const result = await db.collection("workerRuns").updateOne(
      {
        runKey,
        $or: [
          { status: { $exists: false } },
          {
            status: "FAILED",
            $or: [
              { retryAfter: { $exists: false } },
              { retryAfter: { $lte: now } },
            ],
          },
          { status: "RUNNING", leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { status: "RUNNING", startedAt: now, updatedAt: now, leaseUntil: new Date(now.getTime() + DAILY_LEASE_MS) },
        $setOnInsert: { runKey, createdAt: now },
      },
      { upsert: true },
    );
    const claimed = result.upsertedCount === 1 || result.modifiedCount === 1;
    console.info(JSON.stringify({ type: "lowblock.worker.run_claim", runKey, claimed, at: now.toISOString() }));
    return claimed;
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function finishRun(db: Db, runKey: string, status: "DONE" | "FAILED", result?: unknown, error?: unknown) {
  const retryAfter = status === "FAILED"
    // A transient provider/network failure must be retried during the same
    // daily window. Waiting a full day made one failed run look like a
    // successfully skipped day to users.
    ? new Date(Date.now() + 15 * 60_000)
    : undefined;
  const finishedAt = new Date();
  await db.collection("workerRuns").updateOne(
    { runKey, status: "RUNNING" },
    {
      $set: {
        status,
        result,
        error: error instanceof Error ? error.message : error ? String(error) : undefined,
        finishedAt,
        updatedAt: finishedAt,
        ...(retryAfter ? { retryAfter } : {}),
      },
      $unset: { leaseUntil: "", ...(status === "DONE" ? { retryAfter: "" } : {}) },
    },
  );
  console.info(JSON.stringify({ type: "lowblock.worker.run_finished", runKey, status, retryAfter: retryAfter?.toISOString() ?? null, at: finishedAt.toISOString(), error: error instanceof Error ? error.message : error ? String(error) : null }));
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
  const cycleStartedAt = new Date();
  const cycleId = cycleStartedAt.toISOString();
  const clock = localWorkerClock(cycleStartedAt);
  console.info(JSON.stringify({ type: "lowblock.worker.cycle_started", cycleId, clock, timezone: process.env.APP_TIMEZONE || "Asia/Tehran", dailyWindow: isDailyWorkerWindow(cycleStartedAt) }));
  try {
    const heartbeatDb = await getDb();
    await heartbeatDb.collection("workerHeartbeats").updateOne(
      { worker: "lowblock" },
      { $set: { worker: "lowblock", cycleId, pid: process.pid, at: cycleStartedAt, clock, updatedAt: cycleStartedAt } },
      { upsert: true },
    );
  } catch (error) {
    console.error("lowblock_worker_heartbeat_failed", { cycleId, error: error instanceof Error ? error.message : String(error) });
  }
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
  const today = clock.dateKey || appDateKey();
  let daily = null;
  let h2h = null;
  if (isDailyWorkerWindow(cycleStartedAt)) {
    const db = await getDb();
    const dailyRunKey = `daily-football:${today}`;
    const claimedDailyRun = await claimRun(db, dailyRunKey);
    if (claimedDailyRun) {
      try {
        console.info(JSON.stringify({ type: "lowblock.worker.daily_started", cycleId, runKey: dailyRunKey, dateKey: today }));
        daily = await runCompleteDailyFootballCycle();
        // A provider failure must remain retryable. In particular, do not
        // mark the run DONE when one or more of the three date reads failed.
        await finishRun(db, dailyRunKey, daily.ok ? "DONE" : "FAILED", { daily });
      } catch (error) {
        await finishRun(db, dailyRunKey, "FAILED", undefined, error);
        console.error("local_daily_cycle_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      console.info(JSON.stringify({ type: "lowblock.worker.daily_skipped", cycleId, runKey: dailyRunKey, reason: "lease-or-retry-window" }));
    }
    h2h = (daily as any)?.h2h ?? null;
  }
  let teamLogos = null;
  if (Date.now() - lastTeamLogoSyncAt >= 15 * 60_000) {
    lastTeamLogoSyncAt = Date.now();
    try {
      teamLogos = await downloadMissingTeamLogos(6);
    } catch (error) {
      console.error("team_logo_sync_failed", error instanceof Error ? error.message : String(error));
    }
  }
  return {
    notifications,
    jobs,
    daily,
    h2h,
    teamLogos,
    errors: {
      notificationSchedulingError,
      notificationProcessingError,
    },
  };
}

export async function workerStatus() {
  const db = await getDb();
  const latestRun = await db.collection("workerRuns").findOne({}, { sort: { updatedAt: -1 } });
  const latestDailyRun = await db.collection("workerRuns").findOne({ runKey: { $regex: /^daily-football:/ } }, { sort: { updatedAt: -1 } });
  const latestSync = await db.collection("syncRuns").findOne({}, { sort: { startedAt: -1 } });
  const heartbeat = await db.collection("workerHeartbeats").findOne({ worker: "lowblock" });
  const requestSince = new Date(Date.now() - 24 * 60 * 60_000);
  return {
    notificationsEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN || process.env.BALE_BOT_TOKEN),
    latestRun,
    latestDailyRun,
    heartbeat,
    latestSync,
    notificationJobs: await localNotificationQueueStatus(),
    sportsApiRequestsLast24h: await db.collection("sportsApiRequests").countDocuments({
      timestamp: { $gte: requestSince },
    }),
    sportsApiRequestBudget: Number(process.env.SPORTSAPI_DAILY_REQUEST_BUDGET || 10),
    latestSportsApiRequest: await db.collection("sportsApiRequests").findOne({}, { sort: { timestamp: -1 } }),
  };
}
