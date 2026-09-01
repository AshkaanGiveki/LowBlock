import { Client } from "@upstash/qstash";
import type { Db } from "mongodb";
import { env } from "@/lib/env";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";

const CHANNEL_ID = env.TELEGRAM_CHANNEL_ID || "@lowblockapp";
const CHANNEL_DAILY_TYPES = ["LEADERBOARD", "MATCHES"] as const;

function tehranDateKey(date = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: env.APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function tehranDayBounds(dateKey: string) { const start = new Date(`${dateKey}T00:00:00+03:30`); return { start, end: new Date(start.getTime() + 86400000) }; }
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
async function claimPublication(db: Db, dateKey: string, type: typeof CHANNEL_DAILY_TYPES[number]) { const result = await db.collection("channelPublications").updateOne({ dateKey, type }, { $setOnInsert: { dateKey, type, status: "PROCESSING", createdAt: new Date() }, $set: { updatedAt: new Date() } }, { upsert: true }); return result.upsertedCount === 1; }
async function markSent(db: Db, dateKey: string, type: string, messageId: number) { await db.collection("channelPublications").updateOne({ dateKey, type }, { $set: { status: "SENT", messageId, sentAt: new Date(), updatedAt: new Date() } }); }

export async function publishChannelLeaderboard(db: Db, date = new Date()) {
  const dateKey = tehranDateKey(date); if (!await claimPublication(db, dateKey, "LEADERBOARD")) return { sent: false, reason: "already-published" };
  const latest = await db.collection<any>("matches").findOne({}, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } });
  const rows = await getCanonicalLeaderboard(db, { seasonStartYear: Number(latest?.seasonStartYear ?? new Date().getUTCFullYear()) }, 10);
  const lines = rows.length ? rows.map((row, index) => `${index + 1}. <b>${escapeHtml(row.username)}</b> — ${row.points} pts`).join("\n") : "No leaderboard points yet.";
  const result = await sendChannelMessage(`🏆 <b>LowBlock Global Leaderboard</b>\n📅 ${dateKey}\n\n${lines}`, "/leaderboard");
  await markSent(db, dateKey, "LEADERBOARD", result.message_id); return { sent: true, messageId: result.message_id, rows: rows.length };
}

export async function publishChannelMatches(db: Db, date = new Date()) {
  const dateKey = tehranDateKey(date); if (!await claimPublication(db, dateKey, "MATCHES")) return { sent: false, reason: "already-published" };
  const bounds = tehranDayBounds(dateKey); const matches = await db.collection<any>("matches").find({ kickoffAt: { $gte: bounds.start, $lt: bounds.end }, status: { $nin: ["VOID", "CANCELLED"] } }).sort({ kickoffAt: 1 }).toArray();
  const rows = matches.length ? matches.map((match) => { const names = fixtureNames(match); const time = new Intl.DateTimeFormat("en-GB", { timeZone: env.APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(match.kickoffAt)); return `⚽ <b>${escapeHtml(names.home)} vs ${escapeHtml(names.away)}</b> — ${time}`; }).join("\n\n") : "No matches today.";
  const result = await sendChannelMessage(`📅 <b>Today’s fixtures</b>\n\n${rows}`, "/matches"); await markSent(db, dateKey, "MATCHES", result.message_id); return { sent: true, messageId: result.message_id, matches: matches.length };
}

export async function scheduleFirstMatchChannelReminder(db: Db, date = new Date()) {
  if (!env.QSTASH_TOKEN || !env.NEXT_PUBLIC_APP_URL) return false; const dateKey = tehranDateKey(date); const bounds = tehranDayBounds(dateKey);
  const match = await db.collection<any>("matches").findOne({ kickoffAt: { $gte: new Date(Math.max(Date.now(), bounds.start.getTime())), $lt: bounds.end }, status: "SCHEDULED" }, { sort: { kickoffAt: 1 }, projection: { providerMatchId: 1, kickoffAt: 1 } }); if (!match) return false;
  const runAt = new Date(new Date(match.kickoffAt).getTime() - 1800000); if (runAt <= new Date()) return false; await new Client({ token: env.QSTASH_TOKEN }).publishJSON({ url: `${env.NEXT_PUBLIC_APP_URL}/api/notifications/channel-first-match`, body: { dateKey, matchId: match.providerMatchId }, notBefore: Math.floor(runAt.getTime() / 1000), deduplicationId: `lowblock-channel-first-match-${dateKey}` }); return true;
}
export async function scheduleChannelDailyPosts(date = new Date()) {
  if (!env.QSTASH_TOKEN || !env.NEXT_PUBLIC_APP_URL) return 0; const dateKey = tehranDateKey(date); const bounds = tehranDayBounds(dateKey); const jobs = [{ type: "leaderboard", path: "/api/notifications/channel-leaderboard", runAt: new Date(bounds.start.getTime() + 8.5 * 3600000) }, { type: "matches", path: "/api/notifications/channel-matches", runAt: new Date(bounds.start.getTime() + 9 * 3600000) }]; let scheduled = 0;
  for (const job of jobs) { if (job.runAt <= new Date()) continue; await new Client({ token: env.QSTASH_TOKEN }).publishJSON({ url: `${env.NEXT_PUBLIC_APP_URL}${job.path}`, body: { dateKey }, notBefore: Math.floor(job.runAt.getTime() / 1000), deduplicationId: `lowblock-channel-${job.type}-${dateKey}` }); scheduled++; } return scheduled;
}
export async function publishFirstMatchChannelReminder(db: Db, dateKey: string, matchId: string) {
  const match = await db.collection<any>("matches").findOne({ providerMatchId: matchId, status: "SCHEDULED" }); if (!match) return { sent: false, reason: "match-unavailable" }; const names = fixtureNames(match); const text = `⏰ <b>30 minutes until today’s first match</b>\n\n${escapeHtml(names.home)} vs ${escapeHtml(names.away)}\n\nOpen LowBlock to make your prediction.`; const result = await sendChannelMessage(text, `/matches?match=${encodeURIComponent(matchId)}`); return { sent: true, dateKey, messageId: result.message_id };
}
