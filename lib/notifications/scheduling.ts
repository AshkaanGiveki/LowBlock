import { getDb } from "@/lib/db/mongo";
import { scheduleUpcomingReminders } from "./reminders";
import {
  scheduleChannelDailyPosts,
  scheduleFirstMatchChannelReminder,
} from "./channel";

export async function scheduleFootballNotifications() {
  const db = await getDb();
  const remindersScheduled = await scheduleUpcomingReminders();
  let channelReminderScheduled = 0;
  let channelDailyPostsScheduled = 0;
  for (const day of [new Date(), new Date(Date.now() + 86400000)]) {
    channelReminderScheduled += Number(
      await scheduleFirstMatchChannelReminder(db, day),
    );
    channelDailyPostsScheduled += await scheduleChannelDailyPosts(day);
  }
  return {
    remindersScheduled,
    channelReminderScheduled,
    channelDailyPostsScheduled,
  };
}
