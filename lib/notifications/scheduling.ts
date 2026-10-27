import { getDb } from "@/lib/db/mongo";
import { scheduleUpcomingReminders } from "./reminders";
import {
  scheduleChannelDailyPosts,
  scheduleFirstMatchChannelReminder,
} from "./channel";
import { env } from "@/lib/env";

export async function scheduleFootballNotifications() {
  const db = await getDb();
  const remindersScheduled = env.TELEGRAM_BOT_TOKEN || env.BALE_BOT_TOKEN
    ? await scheduleUpcomingReminders()
    : 0;
  let channelReminderScheduled = 0;
  let channelDailyPostsScheduled = 0;
  for (const day of [new Date(), new Date(Date.now() + 86400000)]) {
    if (env.TELEGRAM_BOT_TOKEN) {
      channelReminderScheduled += Number(
        await scheduleFirstMatchChannelReminder(db, day),
      );
      channelDailyPostsScheduled += await scheduleChannelDailyPosts(day);
    }
  }
  return {
    remindersScheduled,
    channelReminderScheduled,
    channelDailyPostsScheduled,
  };
}
