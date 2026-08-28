const IRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

export type LeaderboardPeriod = { start: Date; end: Date };

/**
 * LowBlock weeks run from Friday 03:30:00 Iran time up to (but not including)
 * the following Friday 03:30:00. Iran is UTC+03:30 for the product's current
 * operating calendar, so the boundary is represented as a UTC midnight date.
 */
export function getIranWeeklyPeriod(now = new Date()): LeaderboardPeriod {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const year = Number(value("year"));
  const month = Number(value("month"));
  const day = Number(value("day"));
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekday = weekdays.indexOf(value("weekday"));
  const iranDateAsUtc = Date.UTC(year, month - 1, day);
  const beforeFridayBoundary = weekday === 5 && (hour < 3 || (hour === 3 && minute < 30));
  const effectiveWeekday = beforeFridayBoundary ? 4 : weekday;
  const daysSinceFriday = (effectiveWeekday - 5 + 7) % 7;
  const effectiveDate = iranDateAsUtc - (beforeFridayBoundary ? 86400000 : 0);
  const start = new Date(effectiveDate - daysSinceFriday * 86400000);
  // The Iran 03:30 boundary is midnight UTC under the current Iran offset.
  // Keep the offset explicit so the contract is clear and easy to revise if
  // the product ever changes its operating timezone.
  const boundary = new Date(start.getTime() + IRAN_OFFSET_MS - IRAN_OFFSET_MS);
  return { start: boundary, end: new Date(boundary.getTime() + 7 * 86400000) };
}
