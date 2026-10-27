import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getFootballProvider } from "@/lib/football/providerRegistry";
import { getDb } from "@/lib/db/mongo";
import { scheduleFootballNotifications } from "@/lib/notifications/scheduling";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";

export const maxDuration = 60;

async function run(request: Request) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const startedAt = new Date();
  const attempt = Number(new URL(request.url).searchParams.get("retry") ?? "0");
  try {
    // Schedule from the already persisted fixture set before the provider sync.
    // Sync/score rebuilds can be expensive and may hit Vercel's function limit;
    // reminders must not depend on those later stages completing first.
    let remindersScheduled = 0;
    let channelReminderScheduled = 0;
    let channelDailyPostsScheduled = 0;
    let notificationError: string | null = null;
    try {
      const scheduled = await scheduleFootballNotifications();
      remindersScheduled = scheduled.remindersScheduled;
      channelReminderScheduled = scheduled.channelReminderScheduled;
      channelDailyPostsScheduled = scheduled.channelDailyPostsScheduled;
    } catch (error) {
      notificationError = error instanceof Error ? error.message : "unknown";
      console.error("notification_scheduling_failed", {
        error: notificationError,
        phase: "before_sync",
      });
    }

    const provider = getFootballProvider();
    const result = await provider.sync({ deferScoring: true });
    // Do not run a shadow provider from the scheduled path. It duplicates the
    // full discovery batch and can exhaust the daily football-data quota.
    
    // Run a second pass after sync so newly discovered or rescheduled fixtures
    // are covered as well. The first pass protects reminders if sync times out.
    try {
      const scheduled = await scheduleFootballNotifications();
      remindersScheduled += scheduled.remindersScheduled;
      channelReminderScheduled += scheduled.channelReminderScheduled;
      channelDailyPostsScheduled += scheduled.channelDailyPostsScheduled;
    } catch (error) {
      notificationError ??= error instanceof Error ? error.message : "unknown";
      console.error("notification_scheduling_failed", {
        error: error instanceof Error ? error.message : "unknown",
        phase: "after_sync",
      });
    }
    return NextResponse.json({
      ok: true,
      ...result,
      remindersScheduled,
      channelReminderScheduled,
      channelDailyPostsScheduled,
      notifications: {
        ok: !notificationError,
        dispatcher: "local-mongodb-queue",
        error: notificationError,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    console.error("football_sync_failed", { startedAt, message });
    let recovery: unknown = null;
    try {
      // Provider failure must not leave already-persisted finished matches
      // unscored. This uses MongoDB only and does not call the football API.
      recovery = await runLeaderboardEngine();
    } catch (recoveryError) {
      console.error("football_sync_recovery_failed", {
        error:
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError),
      });
    }
    const retryable =
      attempt < 3 &&
      !/suspended|account|401|403|DAILY_LIMIT|API_KEY|configured/i.test(
        message,
      );
    const retryAt: string | null = null;
    try {
      await (
        await getDb()
      )
        .collection("syncRuns")
        .insertOne({
          provider: getFootballProvider().name,
          mode: env.FOOTBALL_API_MODE,
          startedAt,
          finishedAt: new Date(),
          status: "FAILED",
          error: message,
          attempt,
          retryable,
          retryAt,
        });
    } catch (recordingError) {
      console.error("football_sync_failure_recording_failed", recordingError);
    }
    return NextResponse.json({ ok: false, error: message, recovery }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
