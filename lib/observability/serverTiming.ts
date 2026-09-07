import { NextResponse } from "next/server";

type TimingEntry = { name: string; durationMs: number };

export async function withServerTiming<T>(name: string, operation: () => Promise<T>, timings: TimingEntry[]) {
  const started = performance.now();
  try { return await operation(); } finally { timings.push({ name, durationMs: Math.round((performance.now() - started) * 100) / 100 }); }
}

export function timingHeaders(timings: TimingEntry[], extra: HeadersInit = {}) {
  const headers = new Headers(extra);
  headers.set("Server-Timing", timings.map(item => `${item.name};dur=${item.durationMs}`).join(", "));
  headers.set("X-Request-Timing", JSON.stringify(timings));
  return headers;
}

export function jsonWithTiming<T>(payload: T, timings: TimingEntry[], init?: ResponseInit) {
  return NextResponse.json(payload, { ...init, headers: timingHeaders(timings, init?.headers) });
}
