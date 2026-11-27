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
let lastH2HPublishCheckAt = 0;

async function claimRun(db: Db, runKey: string) {
  const now = new Date();
  try {
    const result = await db.collection("workerRuns").updateOne(
      {
        runKey,
        $or: [
          { status: { $exists: false } },
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
      },
      $unset: { leaseUntil: "", retryAfter: "" },
    },
  );
  console.info(JSON.stringify({ type: "lowblock.worker.run_finished", runKey, status, retryAfter: null, at: finishedAt.toISOString(), error: error instanceof Error ? error.message : error ? String(error) : null }));
}

export async function runH2HCycle() {
  if (!isH2HEnabled()) return { enabled: false };
  const db = await getDb();
  const now = new Date();
  const currentWeek = getH2HWeek(now);
  const localToday = appDateKey(now);
  const localTomorrow = appDateKey(new Date(now.getTime() + 86_400_000));
  const scheduled = [] as any[];
  // A published fixture list is immutable. The existing H2H publication guard
  // will only append an unpublished slate for a currently valid matchday.
  // This catches Friday's new-week rollover and Saturday's fixtures when
  // they enter the public matches-page window after local midnight.
  for (const date of [localToday, localTomorrow]) {
    const schedule = await ensureCurrentH2HLeagues(db, {
      sourceDate: date, batchIndex: 0, batchSize: 1000,
    });
    scheduled.push({ date, schedule });
  }
  return { enabled: true, weekKey: currentWeek.key, scheduled };
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
        // A failed daily run is terminal for this date. Recovery is explicit
        // through the GitHub workflow or /sync_now, so a provider outage
        // cannot trigger another quota-consuming cycle every 15 minutes.
        await finishRun(db, dailyRunKey, daily.ok ? "DONE" : "FAILED", { daily });
      } catch (error) {
        await finishRun(db, dailyRunKey, "FAILED", undefined, error);
        console.error("local_daily_cycle_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      console.info(JSON.stringify({ type: "lowblock.worker.daily_skipped", cycleId, runKey: dailyRunKey, reason: "already-claimed-or-terminal" }));
    }
    h2h = (daily as any)?.h2h ?? null;
  }
  // Publishing is not restricted to the early daily data-sync window.
  // At Friday noon the competition week rolls over, and the next day only
  // becomes eligible for preview once its matches enter the public window.
  if (isH2HEnabled() && Date.now() - lastH2HPublishCheckAt >= 60 * 60_000) {
    lastH2HPublishCheckAt = Date.now();
    try {
      h2h = await runH2HCycle();
    } catch (error) {
      console.error("lowblock.h2h.publication_cycle_failed",
        error instanceof Error ? error.message : String(error));
    }
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
  const [leaderboardPendingCount, latestLeaderboardPublication] = await Promise.all([
    db.collection("leaderboardRebuildQueue").countDocuments(),
    db.collection<any>("leaderboardPublications").findOne(
      { _id: "GLOBAL:HISTORY" },
      { projection: { _id: 1, publishedAt: 1, rowLimit: 1, version: 1 } },
    ),
  ]);
  const requestSince = new Date(Date.now() - 24 * 60 * 60_000);
  return {
    notificationsEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN || process.env.BALE_BOT_TOKEN),
    latestRun,
    latestDailyRun,
    heartbeat,
    latestSync,
    leaderboardHealth: {
      pendingRebuildItems: leaderboardPendingCount,
      globalHistoricalPublishedAt: latestLeaderboardPublication?.publishedAt ?? null,
      publicationVersion: latestLeaderboardPublication?.version ?? null,
    },
    notificationJobs: await localNotificationQueueStatus(),
    sportsApiRequestsLast24h: await db.collection("sportsApiRequests").countDocuments({
      timestamp: { $gte: requestSince },
    }),
    sportsApiRequestBudget: Number(process.env.SPORTSAPI_DAILY_REQUEST_BUDGET || 10),
    latestSportsApiRequest: await db.collection("sportsApiRequests").findOne({}, { sort: { timestamp: -1 } }),
  };
}
