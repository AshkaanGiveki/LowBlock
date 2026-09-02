import { getDb } from "@/lib/db/mongo";
import { scheduleMatchReminder } from "./qstash";
import { env } from "@/lib/env";
import { teamName } from "@/lib/football/team-names";
import { readableFa } from "@/lib/text";
import { isGlobalCompetition } from "@/lib/football/leagues";

type Provider = "TELEGRAM" | "BALE";
const preferenceField = (provider: Provider) => provider === "TELEGRAM" ? "telegramPredictionRemindersEnabled" : "balePredictionRemindersEnabled";

export async function scheduleUpcomingReminders() { const db = await getDb(); const matches = await db.collection<any>("matches").find({ kickoffAt: { $gt: new Date() }, status: "SCHEDULED" }).toArray(); let scheduled = 0; for (const match of matches) { const at = new Date(new Date(match.kickoffAt).getTime() - 1800000); if (at <= new Date()) continue; try { if (await scheduleMatchReminder(match.providerMatchId, at)) scheduled++; } catch (error) { console.error("match_reminder_scheduling_failed", { matchId: match.providerMatchId, error: error instanceof Error ? error.message : "unknown" }); } } return scheduled; }

export async function processMatchReminder(matchId: string) {
  const db = await getDb(); const match = await db.collection<any>("matches").findOne({ providerMatchId: matchId }); if (!match || match.status !== "SCHEDULED") return { sent: 0, skipped: "match" };
  const delta = new Date(match.kickoffAt).getTime() - Date.now(); if (delta < 1200000 || delta > 2400000) return { sent: 0, skipped: "stale" };
  const identities = await db.collection<any>("externalIdentities").aggregate([
    { $match: { provider: { $in: ["TELEGRAM", "BALE"] }, canMessage: true } },
    { $lookup: { from: "notificationPreferences", localField: "userId", foreignField: "userId", as: "preferences" } },
    { $lookup: { from: "predictions", let: { uid: "$userId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$uid"] }, { $eq: ["$matchId", matchId] }] } } }], as: "prediction" } },
    { $match: { prediction: { $size: 0 } } },
  ]).toArray(); let sent = 0;
  for (const identity of identities) {
    const provider = String(identity.provider) as Provider; const preferences = identity.preferences?.[0]; if (preferences?.[preferenceField(provider)] === false) continue;
    if (provider === "TELEGRAM" && preferences?.telegramReminderScope === "GLOBAL_LEADERBOARD" && !isGlobalCompetition(String(match.leagueCode ?? ""))) continue;
    const channel = provider; const deliveryFilter = { userId: identity.userId, matchId, channel, type: "MISSING_PREDICTION_30_MIN" }; const reservation = await db.collection("notificationDeliveries").updateOne(deliveryFilter, { $setOnInsert: { ...deliveryFilter, status: "PROCESSING", createdAt: new Date(), updatedAt: new Date() } }, { upsert: true }); if (!reservation.upsertedCount) continue;
    try { const language = preferences?.language === "en" ? "en" : "fa"; const result = await sendPlatform(provider, String(identity.chatId || identity.providerUserId), match, language); await db.collection("notificationDeliveries").updateOne(deliveryFilter, { $set: { status: "SENT", sentAt: new Date(), externalMessageId: String(result?.message_id ?? result?.id ?? "sent"), updatedAt: new Date() } }); sent++; } catch (error) { await db.collection("notificationDeliveries").updateOne(deliveryFilter, { $set: { status: "FAILED", errorCode: error instanceof Error ? error.message : `${provider}_ERROR`, updatedAt: new Date() } }); }
  }
  return { sent };
}

async function sendPlatform(provider: Provider, chatId: string, match: any, language: "fa" | "en") {
  const token = provider === "TELEGRAM" ? env.TELEGRAM_BOT_TOKEN : env.BALE_BOT_TOKEN; if (!token) throw Error(`${provider}_NOT_CONFIGURED`);
  const home = language === "fa" ? readableFa(teamName("fa", Number(match.homeTeam?.id), match.homeTeam?.name || "Home")) : match.homeTeam?.name || "Home"; const away = language === "fa" ? readableFa(teamName("fa", Number(match.awayTeam?.id), match.awayTeam?.name || "Away")) : match.awayTeam?.name || "Away";
  const text = language === "fa" ? `⚽ یادآوری پیش‌بینی\n\n${home} مقابل ${away}، ۳۰ دقیقه دیگر شروع می‌شود.\n\nهنوز پیش‌بینی خود را ثبت نکرده‌اید.` : `⚽ Prediction reminder\n\n${home} vs ${away} starts in 30 minutes.\n\nYou haven't submitted your prediction yet.`;
  const endpoint = provider === "TELEGRAM" ? `https://api.telegram.org/bot${token}/sendMessage` : `${env.BALE_API_BASE_URL.replace(/\/$/, "")}/${token}/sendMessage`; const button = language === "fa" ? "ثبت پیش‌بینی" : "Make prediction"; const markup = provider === "TELEGRAM" ? { inline_keyboard: [[{ text: button, style: "success", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/matches?match=${encodeURIComponent(match.providerMatchId)}` } }]] } : { inline_keyboard: [[{ text: button, url: `${env.NEXT_PUBLIC_APP_URL}/matches?match=${encodeURIComponent(match.providerMatchId)}` }]] };
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, reply_markup: markup }) }); const data = await response.json().catch(() => null); if (!response.ok || !data?.ok) throw Error(data?.description || `${provider}_${response.status}`); return data.result;
}
