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

export function addSerializationTiming<T>(payload: T, timings: TimingEntry[]) {
  const started = performance.now();
  const body = JSON.stringify(payload);
  timings.push({ name: "serialize", durationMs: Math.round((performance.now() - started) * 100) / 100 });
  return { body, bytes: new TextEncoder().encode(body).byteLength };
}

export function jsonWithTiming<T>(payload: T, timings: TimingEntry[], init?: ResponseInit) {
  const serialized = addSerializationTiming(payload, timings);
  const headers = timingHeaders(timings, init?.headers);
  headers.set("X-Response-Bytes", String(serialized.bytes));
  headers.set("X-Cache-Metrics", "instrumented");
  return new NextResponse(serialized.body, { ...init, headers: new Headers({ ...Object.fromEntries(headers.entries()), "content-type": "application/json" }) });
}
