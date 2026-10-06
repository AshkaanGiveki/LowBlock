import { env } from "@/lib/env";

const DAY_MS = 86_400_000;

export function appDateKey(value = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: env.APP_TIMEZONE || "Asia/Tehran",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

function addDays(dateKey: string, days: number) {
  const value = new Date(`${dateKey}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function providerDateKeys(value = new Date()): string[] {
  const today = appDateKey(value);
  return [addDays(today, -1), today, addDays(today, 1)];
}

export function appDayBounds(value = new Date()) {
  const today = appDateKey(value);
  const start = new Date(`${today}T00:00:00+03:30`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}
