import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncFootballApi } from "@/lib/football/api-sports/sync";
import { getDb } from "@/lib/db/mongo";
import { scheduleUpcomingReminders } from "@/lib/notifications/reminders";
import { scheduleFirstMatchChannelReminder, scheduleChannelDailyPosts } from "@/lib/notifications/channel";

async function run(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { const result=await syncFootballApi(); let remindersScheduled=0; let channelReminderScheduled=0; let channelDailyPostsScheduled=0; try { const db=await getDb(); remindersScheduled=await scheduleUpcomingReminders(); for (const day of [new Date(), new Date(Date.now()+86400000)]) { channelReminderScheduled+=Number(await scheduleFirstMatchChannelReminder(db, day)); channelDailyPostsScheduled+=await scheduleChannelDailyPosts(day); } } catch (error) { console.error("notification_scheduling_failed",{error:error instanceof Error?error.message:"unknown"}); } return NextResponse.json({ ok: true, ...result, remindersScheduled, channelReminderScheduled, channelDailyPostsScheduled }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "sync failed" }, { status: 500 }); }
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
