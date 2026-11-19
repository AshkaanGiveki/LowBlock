import { env } from "@/lib/env";

const DAY_MS = 86_400_000;

export function appDateKey(value = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: env.APP_TIMEZONE || "Asia/Tehran",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

/** Operational schedule days run from 12:00 to 12:00 in the app timezone. */
export function appScheduleDateKey(value = new Date()): string {
  return appDateKey(new Date(value.getTime() - 12 * 60 * 60 * 1000));
}

export function appLocalDateTimeToUtc(dateKey: string, hour = 0, minute = 0): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: env.APP_TIMEZONE || "Asia/Tehran",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(rough);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const zoneAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return new Date(rough.getTime() - (zoneAsUtc - rough.getTime()));
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

/** Returns the seven local calendar dates in the Friday-to-Thursday app week. */
export function providerWeekDateKeys(value = new Date()): string[] {
  const today = appDateKey(value);
  const local = new Date(`${today}T00:00:00.000Z`);
  const daysSinceFriday = (local.getUTCDay() + 2) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceFriday);
  return Array.from({ length: 7 }, (_, index) => addDays(local.toISOString().slice(0, 10), index));
}

/** Matches page window: all of today plus tomorrow before local noon. */
export function appMatchesPageBounds(value = new Date()) {
  const date = appDateKey(value);
  const tomorrow = addDays(date, 1);
  return {
    start: appLocalDateTimeToUtc(date),
    end: appLocalDateTimeToUtc(tomorrow, 12),
  };
}

export function appDayBounds(value = new Date()) {
  const scheduleDate = appScheduleDateKey(value);
  const endDate = addDays(scheduleDate, 1);
  return {
    start: appLocalDateTimeToUtc(scheduleDate, 12),
    end: appLocalDateTimeToUtc(endDate, 12),
  };
}

/** SportsAPI quota days reset at 00:00 UTC, not at the Tehran calendar day. */
export function providerDayBounds(value = new Date()) {
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  return { start, end: new Date(start.getTime() + DAY_MS) };
}
