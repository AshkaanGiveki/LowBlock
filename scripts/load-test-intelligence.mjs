#!/usr/bin/env node
/**
 * Read-only load test for an isolated Match Intelligence preview.
 * Never contacts SportsAPI. Explicitly refuses LowBlock production hosts.
 *
 * Usage:
 *   node scripts/load-test-intelligence.mjs \
 *     https://lowblock-preview.example.test/api/matches/123/intelligence 50 200
 */
const [rawUrl, rawConcurrency = "50", rawRequests = "200"] = process.argv.slice(2);
if (!rawUrl) {
  console.error("Expected an isolated staging Match Intelligence API URL.");
  process.exit(2);
}
const target = new URL(rawUrl);
const host = target.hostname.toLowerCase();
const allowed = host === "localhost" || host === "127.0.0.1" ||
  host.startsWith("lowblock-preview.") || host.startsWith("lowblock-staging.");
if (!allowed || !/^\/api\/matches\/[a-zA-Z0-9_-]+\/intelligence$/.test(target.pathname) || target.protocol === "http:" && !["localhost", "127.0.0.1"].includes(host)) {
  console.error("Refusing to load-test a non-staging or non-intelligence endpoint.");
  process.exit(2);
}
const concurrency = Number(rawConcurrency);
const total = Number(rawRequests);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 500 ||
    !Number.isInteger(total) || total < concurrency || total > 5000) {
  throw new RangeError("Valid bounds: 1-500 viewers and viewers <= requests <= 5000");
}
const timings = [];
const responseCodes = new Map();
let completed = 0;
let failed = 0;
let bytes = 0;
let cursor = 0;
let etag = null;

const first = await fetch(target, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
if (!first.ok) throw new Error(`Staging preflight returned ${first.status}`);
const firstBody = await first.json();
if (!firstBody.match?.providerMatchId || !firstBody.availability) {
  throw new Error("Not a valid Match Intelligence response");
}
etag = first.headers.get("etag");

async function viewer() {
  for (;;) {
    const index = cursor++;
    if (index >= total) return;
    const start = performance.now();
    try {
      const response = await fetch(target, {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
        headers: etag ? { "If-None-Match": etag } : {},
      });
      const body = await response.arrayBuffer();
      bytes += body.byteLength;
      responseCodes.set(response.status, (responseCodes.get(response.status) ?? 0) + 1);
      if (response.status !== 200 && response.status !== 304) failed++;
    } catch (error) {
      failed++;
      if (failed <= 5) console.error("Request failed:", error instanceof Error ? error.message : error);
    } finally {
      timings.push(performance.now() - start);
      completed++;
    }
  }
}

const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => viewer()));
const elapsed = performance.now() - started;
const ordered = timings.sort((a, b) => a - b);
const percentile = (p) => Math.round(ordered[Math.min(ordered.length - 1, Math.ceil(p * ordered.length) - 1)] ?? 0);
const summary = {
  target: target.origin + target.pathname,
  concurrentViewers: concurrency,
  requests: total,
  completed,
  failed,
  responseCodes: Object.fromEntries(responseCodes),
  elapsedMs: Math.round(elapsed),
  throughputRequestsPerSec: Math.round((completed / (elapsed / 1000)) * 100) / 100,
  p50Ms: percentile(0.5),
  p95Ms: percentile(0.95),
  p99Ms: percentile(0.99),
  transferredBytes: bytes,
  providerCallsFromBrowser: 0,
};
console.log(JSON.stringify(summary, null, 2));
if (failed > 0) process.exitCode = 1;
