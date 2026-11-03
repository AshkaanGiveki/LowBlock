export function localWorkerClock(
  date = new Date(),
  timeZone = process.env.APP_TIMEZONE || "Asia/Tehran",
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    dateKey: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

export function isDailyWorkerWindow(date = new Date(), timeZone?: string) {
  const clock = localWorkerClock(date, timeZone);
  // SportsAPI's daily quota resets at 00:00 UTC (03:30 Asia/Tehran).
  // Start at the agreed 03:30 Asia/Tehran window after the provider quota
  // reset. The recovery workflow itself runs at 03:40 as an extra buffer.
  return clock.hour > 3 || (clock.hour === 3 && clock.minute >= 30);
}
