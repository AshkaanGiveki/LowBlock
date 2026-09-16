import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncFootballApi } from "@/lib/football/api-sports/sync";
import { getDb } from "@/lib/db/mongo";
import { scheduleUpcomingReminders } from "@/lib/notifications/reminders";
import {
  scheduleFirstMatchChannelReminder,
  scheduleChannelDailyPosts,
} from "@/lib/notifications/channel";
import { Client } from "@upstash/qstash";

async function run(request: Request) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const startedAt = new Date();
  const attempt = Number(new URL(request.url).searchParams.get("retry") ?? "0");
  try {
    const result = await syncFootballApi();
    let remindersScheduled = 0;
    let channelReminderScheduled = 0;
    let channelDailyPostsScheduled = 0;
    try {
      const db = await getDb();
      remindersScheduled = await scheduleUpcomingReminders();
      for (const day of [new Date(), new Date(Date.now() + 86400000)]) {
        channelReminderScheduled += Number(
          await scheduleFirstMatchChannelReminder(db, day),
        );
        channelDailyPostsScheduled += await scheduleChannelDailyPosts(day);
      }
    } catch (error) {
      console.error("notification_scheduling_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    return NextResponse.json({
      ok: true,
      ...result,
      remindersScheduled,
      channelReminderScheduled,
      channelDailyPostsScheduled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    console.error("football_sync_failed", { startedAt, message });
    const retryable =
      attempt < 3 &&
      !/suspended|account|401|403|DAILY_LIMIT|API_KEY|configured/i.test(
        message,
      );
    let retryAt: string | null = null;
    if (retryable && env.QSTASH_TOKEN && env.NEXT_PUBLIC_APP_URL) {
      const delay = [5, 15, 30][attempt] * 60_000;
      retryAt = new Date(Date.now() + delay).toISOString();
      try {
        await new Client({ token: env.QSTASH_TOKEN }).publishJSON({
          url: `${env.NEXT_PUBLIC_APP_URL}/api/cron/sync-football?retry=${attempt + 1}`,
          body: { reason: "transient-sync-failure", attempt: attempt + 1 },
          headers: { authorization: `Bearer ${env.CRON_SECRET}` },
          notBefore: Math.floor(new Date(retryAt).getTime() / 1000),
          deduplicationId: `lowblock-football-sync-retry-${startedAt.getTime()}-${attempt + 1}`,
        });
      } catch (retryError) {
        console.error("football_sync_retry_schedule_failed", {
          error:
            retryError instanceof Error
              ? retryError.message
              : String(retryError),
        });
      }
    }
    try {
      await (
        await getDb()
      )
        .collection("syncRuns")
        .insertOne({
          provider: "football-api",
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
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
