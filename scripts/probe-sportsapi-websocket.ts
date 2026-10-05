import "../lib/env";

type ProbeMessage = Record<string, any>;
const key = process.env.SPORTSAPI_API_KEY;
const wsUrl = process.env.SPORTSAPI_WS_URL || "wss://api.sportsapipro.com/v2/football/ws";
const matchId = process.env.SPORTSAPI_TEST_MATCH_ID;
const timeoutMs = Number(process.env.SPORTSAPI_WS_PROBE_TIMEOUT_MS || 15_000);
const includeRaw = process.env.SPORTSAPI_WS_PROBE_RAW === "1";

if (!key) {
  console.error("SPORTSAPI_API_KEY is required.");
  process.exit(2);
}
const apiKey = key;

const channels = ["live-scores", ...(matchId ? [
  `match:${matchId}`,
  `match:${matchId}:incidents`,
  `match:${matchId}:stats`,
  `match:${matchId}:lineups`,
  `match:${matchId}:odds`,
] : [])];
const observed = new Map<string, number>();
const messages: ProbeMessage[] = [];
const matchIds = new Set<string>();
const startedAt = Date.now();

async function main() {
await new Promise<void>((resolve) => {
  const socket = new WebSocket(`${wsUrl}?x-api-key=${encodeURIComponent(apiKey)}`);
  const timeout = setTimeout(() => { socket.close(); resolve(); }, timeoutMs);
  socket.onopen = () => {
    for (const channel of channels) socket.send(JSON.stringify({ action: "subscribe", channel }));
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as ProbeMessage;
      messages.push(payload);
      collectMatchIds(payload);
      const channel = payload.channel || payload.event || payload.type || "unclassified";
      observed.set(channel, (observed.get(channel) || 0) + 1);
    } catch { /* Ignore non-JSON frames. */ }
  };
  socket.onerror = () => { clearTimeout(timeout); socket.close(); resolve(); };
  socket.onclose = () => { clearTimeout(timeout); resolve(); };
});

const hasError = messages.some((message) => Boolean(message.error) || message.type === "error" || message.action === "error");
console.log(JSON.stringify({
  endpoint: wsUrl,
  elapsedMs: Date.now() - startedAt,
  requestedChannels: channels,
  observedFrames: messages.length,
  observedChannels: Object.fromEntries(observed),
  sampleMatchIds: Array.from(matchIds).slice(0, 10),
  ...(includeRaw ? { rawFrames: messages } : {}),
  serverRejectedOrErrored: hasError,
  matchId: matchId || null,
  verdict: messages.length > 0 && !hasError ? "stream-replied" : "inconclusive-or-rejected",
  note: matchId
    ? "A positive result proves frames for this match, not replay/no-gap guarantees."
    : "Set SPORTSAPI_TEST_MATCH_ID to test match-specific rich-data channels.",
}, null, 2));
if (hasError || messages.length === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function collectMatchIds(value: unknown, depth = 0) {
  if (depth > 5 || value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (["id", "eventId", "matchId", "fixtureId"].includes(key) && (typeof nested === "string" || typeof nested === "number")) {
      matchIds.add(String(nested));
    }
    collectMatchIds(nested, depth + 1);
  }
}
