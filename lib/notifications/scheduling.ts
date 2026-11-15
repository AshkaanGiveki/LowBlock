import { getDb } from "@/lib/db/mongo";
import { scheduleUpcomingReminders } from "./reminders";
import {
  scheduleChannelDailyPosts,
  scheduleFirstMatchChannelReminder,
} from "./channel";
import { env } from "@/lib/env";
import { telegramEnabled } from "@/lib/telegram/client";

export async function scheduleFootballNotifications() {
  const db = await getDb();
  const remindersScheduled = telegramEnabled() || env.BALE_BOT_TOKEN
    ? await scheduleUpcomingReminders()
    : 0;
  let channelReminderScheduled = 0;
  let channelDailyPostsScheduled = 0;
  for (const day of [new Date(), new Date(Date.now() + 86400000)]) {
    if (telegramEnabled()) {
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
