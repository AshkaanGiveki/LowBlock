import { Client } from "@upstash/qstash";
import type { Db } from "mongodb";
import { env } from "@/lib/env";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { scheduleMatchdayPolling } from "@/lib/notifications/matchday";

const CHANNEL_ID = env.TELEGRAM_CHANNEL_ID || "@lowblockapp";
const CHANNEL_PUBLICATION_TYPES = ["LEADERBOARD", "MATCHES", "FIRST_MATCH"] as const;
type ChannelPublicationType = typeof CHANNEL_PUBLICATION_TYPES[number];
const TELEGRAM_MESSAGE_LIMIT = 4096;
const STALE_PROCESSING_AFTER_MS = 10 * 60_000;

function utcDateKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function utcDayBounds(dateKey: string) { const start = new Date(`${dateKey}T00:00:00.000Z`); return { start, end: new Date(start.getTime() + 86400000) }; }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function botLink(path: string) { return env.TELEGRAM_BOT_USERNAME ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp=${encodeURIComponent(path)}` : `${env.NEXT_PUBLIC_APP_URL}${path}`; }
function fixtureNames(match: any) { return { home: match.homeTeam?.name || "Home", away: match.awayTeam?.name || "Away" }; }

async function sendChannelMessage(text: string, url = `${env.NEXT_PUBLIC_APP_URL}/matches`) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_NOT_CONFIGURED");
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: CHANNEL_ID, text, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "⚽ Predict now", style: "success", url: botLink(url) }]] } }) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.description || `TELEGRAM_${response.status}`);
  return body.result;
}
function splitTelegramText(text: string) {
  const chunks: string[] = [];
  let chunk = "";
  for (const line of text.split("\n")) {
    const candidate = chunk ? `${chunk}\n${line}` : line;
    if (candidate.length <= TELEGRAM_MESSAGE_LIMIT) {
      chunk = candidate;
      continue;
    }
    if (chunk) chunks.push(chunk);
    if (line.length <= TELEGRAM_MESSAGE_LIMIT) {
      chunk = line;
      continue;
    }
    for (let offset = 0; offset < line.length; offset += TELEGRAM_MESSAGE_LIMIT) chunks.push(line.slice(offset, offset + TELEGRAM_MESSAGE_LIMIT));
    chunk = "";
  }
  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [""];
}
async function sendChannelMessages(text: string, url = `${env.NEXT_PUBLIC_APP_URL}/matches`) {
  const results = [];
  for (const chunk of splitTelegramText(text)) results.push(await sendChannelMessage(chunk, url));
  return results;
}
async function claimPublication(db: Db, dateKey: string, type: ChannelPublicationType) {
  const now = new Date();
  const existing = await db.collection<any>("channelPublications").findOne({ dateKey, type }, { projection: { status: 1, updatedAt: 1 } });
  if (!existing) {
    try {
      await db.collection("channelPublications").insertOne({ dateKey, type, status: "PROCESSING", createdAt: now, updatedAt: now });
      return true;
    } catch {
      return false;
    }
  }
  if (existing.status === "SENT") return false;
  const stale = existing.status === "PROCESSING" && new Date(existing.updatedAt ?? 0).getTime() >= now.getTime() - STALE_PROCESSING_AFTER_MS;
  if (stale) return false;
  const result = await db.collection("channelPublications").updateOne(
    { dateKey, type, status: { $in: ["FAILED", "PROCESSING"] }, updatedAt: existing.updatedAt },
    { $set: { status: "PROCESSING", updatedAt: now } },
  );
  return result.modifiedCount === 1;
}
async function markSent(db: Db, dateKey: string, type: ChannelPublicationType, messageIds: number[]) { await db.collection("channelPublications").updateOne({ dateKey, type }, { $set: { status: "SENT", messageId: messageIds[0], messageIds, sentAt: new Date(), updatedAt: new Date() } }); }
async function markFailed(db: Db, dateKey: string, type: ChannelPublicationType, error: unknown) { await db.collection("channelPublications").updateOne({ dateKey, type }, { $set: { status: "FAILED", error: error instanceof Error ? error.message : String(error), updatedAt: new Date() } }); }

export async function publishChannelLeaderboard(db: Db, date = new Date()) {
  const dateKey = utcDateKey(date); if (!await claimPublication(db, dateKey, "LEADERBOARD")) return { sent: false, reason: "already-published" };
  const latest = await db.collection<any>("matches").findOne({}, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } });
  const rows = await getCanonicalLeaderboard(db, { seasonStartYear: Number(latest?.seasonStartYear ?? new Date().getUTCFullYear()) }, 10);
  const lines = rows.length ? rows.map((row, index) => `${index + 1}. <b>${escapeHtml(row.username)}</b> — ${row.points} pts`).join("\n") : "No leaderboard points yet.";
  try {
    const results = await sendChannelMessages(`🏆 <b>LowBlock Global Leaderboard</b>\n📅 ${dateKey}\n\n${lines}`, "/leaderboard");
    const messageIds = results.map((result) => result.message_id);
    await markSent(db, dateKey, "LEADERBOARD", messageIds); return { sent: true, messageId: messageIds[0], messageIds, rows: rows.length };
  } catch (error) { await markFailed(db, dateKey, "LEADERBOARD", error); throw error; }
}

export async function publishChannelMatches(db: Db, date = new Date()) {
  const dateKey = utcDateKey(date); if (!await claimPublication(db, dateKey, "MATCHES")) return { sent: false, reason: "already-published" };
  const bounds = utcDayBounds(dateKey); const matches = await db.collection<any>("matches").find({ kickoffAt: { $gte: bounds.start, $lt: bounds.end }, status: { $nin: ["VOID", "CANCELLED"] } }).sort({ kickoffAt: 1 }).toArray();
  const rows = matches.length ? matches.map((match) => { const names = fixtureNames(match); const time = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }).format(new Date(match.kickoffAt)); return `⚽ <b>${escapeHtml(names.home)} vs ${escapeHtml(names.away)}</b> — ${time} UTC`; }).join("\n\n") : "No matches today.";
  try {
    const results = await sendChannelMessages(`📅 <b>Today’s fixtures</b>\n\n${rows}`, "/matches");
    const messageIds = results.map((result) => result.message_id);
    await markSent(db, dateKey, "MATCHES", messageIds); return { sent: true, messageId: messageIds[0], messageIds, matches: matches.length };
  } catch (error) { await markFailed(db, dateKey, "MATCHES", error); throw error; }
}

export async function scheduleFirstMatchChannelReminder(db: Db, date = new Date()) {
  if (!env.QSTASH_TOKEN || !env.NEXT_PUBLIC_APP_URL) return false; const dateKey = utcDateKey(date); const bounds = utcDayBounds(dateKey);
  const match = await db.collection<any>("matches").findOne({ kickoffAt: { $gte: new Date(Math.max(Date.now(), bounds.start.getTime())), $lt: bounds.end }, status: "SCHEDULED" }, { sort: { kickoffAt: 1 }, projection: { providerMatchId: 1, kickoffAt: 1 } }); if (!match) return false;
  const runAt = new Date(new Date(match.kickoffAt).getTime() - 1800000); if (runAt <= new Date()) return false; await new Client({ token: env.QSTASH_TOKEN }).publishJSON({ url: `${env.NEXT_PUBLIC_APP_URL}/api/notifications/channel-first-match`, body: { dateKey, matchId: match.providerMatchId }, notBefore: Math.floor(runAt.getTime() / 1000), deduplicationId: `lowblock-channel-first-match-${dateKey}` }); return true;
}
export async function scheduleChannelDailyPosts(date = new Date()) {
  if (!env.QSTASH_TOKEN || !env.NEXT_PUBLIC_APP_URL) return 0; const dateKey = utcDateKey(date); const bounds = utcDayBounds(dateKey); const jobs = [{ type: "leaderboard", path: "/api/notifications/channel-leaderboard", runAt: new Date(bounds.start.getTime() + 8.5 * 3600000) }, { type: "matches", path: "/api/notifications/channel-matches", runAt: new Date(bounds.start.getTime() + 9 * 3600000) }]; let scheduled = 0;
  for (const job of jobs) { if (job.runAt <= new Date()) continue; await new Client({ token: env.QSTASH_TOKEN }).publishJSON({ url: `${env.NEXT_PUBLIC_APP_URL}${job.path}`, body: { dateKey }, notBefore: Math.floor(job.runAt.getTime() / 1000), deduplicationId: `lowblock-channel-${job.type}-${dateKey}` }); scheduled++; } return scheduled;
}
export async function publishFirstMatchChannelReminder(db: Db, dateKey: string, matchId: string) {
  const match = await db.collection<any>("matches").findOne({ providerMatchId: matchId, kickoffAt: { $gt: new Date() }, status: { $nin: ["VOID", "CANCELLED", "POSTPONED", "FINISHED"] } });
  if (!match) return { sent: false, reason: "match-unavailable", polling: await scheduleMatchdayPolling(db, dateKey) };
  if (!await claimPublication(db, dateKey, "FIRST_MATCH")) return { sent: false, reason: "already-published", polling: await scheduleMatchdayPolling(db, dateKey) };
  const names = fixtureNames(match);
  const text = `⏰ <b>30 minutes until today’s first match</b>\n\n${escapeHtml(names.home)} vs ${escapeHtml(names.away)}\n\nOpen LowBlock to make your prediction.`;
  try {
    const result = await sendChannelMessage(text, `/matches?match=${encodeURIComponent(matchId)}`);
    await markSent(db, dateKey, "FIRST_MATCH", [result.message_id]);
    return { sent: true, dateKey, messageId: result.message_id, polling: await scheduleMatchdayPolling(db, dateKey) };
  } catch (error) { await markFailed(db, dateKey, "FIRST_MATCH", error); throw error; }
}
