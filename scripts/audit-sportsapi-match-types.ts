import "../lib/env";

type Event = Record<string, any>;
type Result = { id: string; category: string; kickoff?: string; status?: any; channels: Record<string, any> };

const key = process.env.SPORTSAPI_API_KEY;
if (!key) throw new Error("SPORTSAPI_API_KEY is required");
const base = process.env.SPORTSAPI_BASE_URL || "https://api.sportsapipro.com/v2/football";
const wsUrl = process.env.SPORTSAPI_WS_URL || "wss://api.sportsapipro.com/v2/football/ws";

async function main() {

const day = (offset: number) => {
  const date = new Date(Date.now() + offset * 86400000);
  return date.toISOString().slice(0, 10);
};

async function getSchedule(date: string): Promise<Event[]> {
  const response = await fetch(`${base}/schedule/${date}`, { headers: { "x-api-key": key! } });
  const body = await response.json().catch(() => ({}));
  return body.events || body.data || [];
}

const [longAgo, recent, today, plusTwo] = await Promise.all([
  getSchedule(day(-30)),
  getSchedule(day(-2)),
  getSchedule(day(0)),
  getSchedule(day(2)),
]);

function eventTime(event: Event) {
  const timestamp = event.startTimestamp || event.startTime || event.kickoffTimestamp;
  return timestamp ? new Date(Number(timestamp) < 2_000_000_000 ? Number(timestamp) * 1000 : Number(timestamp)).getTime() : Number.MAX_SAFE_INTEGER;
}
function status(event: Event) { return String(event.status?.type || event.status?.description || "").toLowerCase(); }
function pick(events: Event[], predicate: (event: Event) => boolean) { return events.find(predicate); }
function id(event?: Event) { return event && String(event.id || event.eventId); }

const now = Date.now();
const selected: Array<{ category: string; event?: Event }> = [
  { category: "finished-long-ago", event: pick(longAgo, (e) => ["finished", "ended"].some((v) => status(e).includes(v))) },
  { category: "finished-recently", event: pick(recent, (e) => ["finished", "ended"].some((v) => status(e).includes(v))) },
  { category: "live", event: pick(today, (e) => ["inprogress", "live"].some((v) => status(e).includes(v))) },
  { category: "upcoming-today", event: pick(today, (e) => eventTime(e) > now && !["finished", "ended", "inprogress", "live"].some((v) => status(e).includes(v))) },
  { category: "two-days-later", event: pick(plusTwo, () => true) },
];

const chosen = selected.filter((entry) => entry.event && id(entry.event)).map((entry) => ({
  category: entry.category,
  event: entry.event!,
  id: id(entry.event!)!,
}));
const channels = (matchId: string) => [
  `match:${matchId}`,
  `match:${matchId}:incidents`,
  `match:${matchId}:stats`,
  `match:${matchId}:lineups`,
  `match:${matchId}:odds`,
];

const results = await new Promise<Result[]>((resolve) => {
  const output: Result[] = chosen.map(({ category, event, id: matchId }) => ({
    id: matchId,
    category,
    kickoff: event.startTimestamp ? new Date(Number(event.startTimestamp) * 1000).toISOString() : undefined,
    status: event.status,
    channels: {},
  }));
  const socket = new WebSocket(`${wsUrl}?x-api-key=${encodeURIComponent(key!)}`);
  const timeout = setTimeout(() => { socket.close(); resolve(output); }, 12_000);
  socket.onopen = () => {
    for (const { id: matchId } of chosen) for (const channel of channels(matchId)) {
      socket.send(JSON.stringify({ action: "subscribe", channel }));
    }
  };
  socket.onmessage = (raw) => {
    try {
      const message = JSON.parse(String(raw.data));
      const match = String(message.channel || "").match(/^match:(\d+)(?::(incidents|stats|lineups|odds))?$/);
      if (!match || !message.type) return;
      const row = output.find((item) => item.id === match[1]);
      if (!row) return;
      const channel = message.channel;
      if (message.type === "subscribed") row.channels[channel] = { type: "subscribed", mode: message.mode };
      if (message.type === "snapshot" || message.type === "update") {
        const data = message.data;
        row.channels[channel] = {
          type: message.type,
          source: message.source,
          dataKind: data?.error ? "error" : data == null ? "missing" : Array.isArray(data) ? "array" : "object",
          error: data?.error,
          topLevelKeys: data && typeof data === "object" ? Object.keys(data).slice(0, 30) : [],
          itemCounts: data && typeof data === "object" ? Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, (value as any[]).length])) : {},
        };
      }
    } catch { /* Ignore malformed frames. */ }
  };
  socket.onerror = () => { clearTimeout(timeout); socket.close(); resolve(output); };
  socket.onclose = () => { clearTimeout(timeout); resolve(output); };
});

console.log(JSON.stringify({ discovered: { longAgo: longAgo.length, recent: recent.length, today: today.length, plusTwo: plusTwo.length }, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
