import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/mongo";
import { getCanonicalLeaderboard } from "@/lib/domain/leaderboards";
import { consumeLinkToken } from "@/lib/platform/identity";

export const runtime = "nodejs";

type TelegramMessage = { text?: string; from?: { id?: number; username?: string; first_name?: string; last_name?: string }; chat?: { id?: number } };

export async function POST(req: Request) {
  const update = await req.json().catch(() => null) as { message?: TelegramMessage } | null;
  const message = update?.message;
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  const chatId = message?.chat?.id;
  const providerUserId = message?.from?.id;
  if (chatId == null || providerUserId == null) return NextResponse.json({ ok: true });
  const from = message?.from ?? {};

  if (text.startsWith("/start ")) {
    const token = text.slice(7).trim();
    let language: "fa" | "en" = "fa";
    try {
      const userId = await userForToken(token);
      language = await userLanguage(userId);
      await consumeLinkToken(token, "TELEGRAM", userId, { id: String(providerUserId), username: from.username, displayName: [from.first_name, from.last_name].filter(Boolean).join(" "), chatId: String(chatId), allowsWrite: true });
      await send(String(chatId), language === "fa" ? "تلگرام با موفقیت متصل شد ✓\n\nحساب تلگرام شما به LowBlock متصل است.\n\nدستورهای موجود:\n/leaderboard — جدول جهانی" : "Telegram connected ✓\n\nYour Telegram account is now connected to LowBlock.\n\nAvailable commands:\n/leaderboard — Global leaderboard", true);
    } catch (error) {
      if (error instanceof Error && error.message === "PLATFORM_IDENTITY_CONFLICT") await send(String(chatId), language === "fa" ? "این حساب تلگرام قبلاً به یک حساب LowBlock دیگر متصل شده است." : "This Telegram account is already connected to another LowBlock account.");
      else await send(String(chatId), language === "fa" ? "لینک اتصال نامعتبر یا منقضی شده است. از تنظیمات LowBlock دوباره شروع کنید." : "This connection link is invalid or expired. Start again from LowBlock settings.");
    }
    return NextResponse.json({ ok: true });
  }

  if (isCommand(text, "leaderboard")) {
    await sendLeaderboard(String(chatId), String(providerUserId));
    return NextResponse.json({ ok: true });
  }

  const command = commandName(text);
  if (["matches", "my_predictions", "results", "profile", "reminders", "settings", "language", "help"].includes(command)) {
    await handleCommand(command, String(chatId), String(providerUserId));
  }

  return NextResponse.json({ ok: true });
}

function commandName(text: string) { return text.match(/^\/([a-z0-9_]+)(?:@[a-z0-9_]+)?(?:\s|$)/i)?.[1]?.toLowerCase() ?? ""; }
function isCommand(text: string, command: string) { return commandName(text) === command; }

type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; style?: "danger" | "success" | "primary"; web_app?: { url: string }; url?: string }>> };

const greenButton = <T extends { text: string; web_app?: { url: string }; url?: string }>(button: T) => ({ ...button, style: "success" as const });

async function handleCommand(command: string, chatId: string, providerUserId: string) {
  const identity = await getTelegramIdentity(providerUserId);
  if (!identity?.userId) {
    await send(chatId, "برای استفاده از ربات، ابتدا حساب تلگرام خود را به LowBlock متصل کنید.\n\nConnect your Telegram account to LowBlock first to use the bot.", connectKeyboard());
    return;
  }
  const language = await userLanguage(identity.userId);
  if (command === "language") {
    const nextLanguage = language === "fa" ? "en" : "fa";
    await (await getDb()).collection("notificationPreferences").updateOne({ userId: identity.userId }, { $set: { language: nextLanguage, updatedAt: new Date() } }, { upsert: true });
    await send(chatId, nextLanguage === "fa" ? "زبان ربات به فارسی تغییر کرد. ✅" : "Bot language changed to English. ✅", mainKeyboard(nextLanguage));
    return;
  }
  const url = env.NEXT_PUBLIC_APP_URL;
  const buttons: Record<string, InlineKeyboard> = {
    matches: { inline_keyboard: [[greenButton({ text: language === "fa" ? "⚽ مسابقه‌های امروز" : "⚽ Today’s matches", web_app: { url: `${url}/matches` } })]] },
    my_predictions: { inline_keyboard: [[greenButton({ text: language === "fa" ? "🎯 پیش‌بینی‌های من" : "🎯 My predictions", web_app: { url: `${url}/profile` } })]] },
    results: { inline_keyboard: [[greenButton({ text: language === "fa" ? "📊 مشاهده نتایج" : "📊 View results", web_app: { url: `${url}/matches?tab=results` } })]] },
    profile: { inline_keyboard: [[greenButton({ text: language === "fa" ? "👤 پروفایل من" : "👤 My profile", web_app: { url: `${url}/profile` } })]] },
    reminders: { inline_keyboard: [[greenButton({ text: language === "fa" ? "🔔 تنظیم یادآوری‌ها" : "🔔 Reminder settings", web_app: { url: `${url}/profile` } })]] },
    settings: { inline_keyboard: [[greenButton({ text: language === "fa" ? "⚙️ باز کردن تنظیمات" : "⚙️ Open settings", web_app: { url: `${url}/profile` } })]] },
    language: { inline_keyboard: [[greenButton({ text: language === "fa" ? "🌐 Language settings" : "🌐 تنظیمات زبان", web_app: { url: `${url}/profile` } })]] },
    help: mainKeyboard(language),
  };
  const messages: Record<string, [string, string]> = {
    matches: ["⚽ مسابقه‌های امروز\n\nبرای دیدن مسابقه‌ها و ثبت پیش‌بینی، دکمه زیر را انتخاب کنید.", "⚽ Today’s matches\n\nOpen today’s fixtures and submit your predictions below."],
    my_predictions: ["🎯 پیش‌بینی‌های شما در پروفایل LowBlock قابل مشاهده است.", "🎯 Your predictions are available in your LowBlock profile."],
    results: ["📊 نتایج و امتیازهای مسابقه‌ها را در LowBlock ببینید.", "📊 View match results and your scored predictions in LowBlock."],
    profile: ["👤 پروفایل، رتبه، امتیازها و افتخارات شما در LowBlock.", "👤 Your profile, rank, points, and awards on LowBlock."],
    reminders: ["🔔 وضعیت یادآوری‌ها را از پروفایل LowBlock مدیریت کنید.", "🔔 Manage your prediction reminders from your LowBlock profile."],
    settings: ["⚙️ تنظیمات حساب و اتصال‌های شما در LowBlock.", "⚙️ Manage your account settings and connected platforms in LowBlock."],
    language: ["زبان پیام‌های ربات از تنظیمات زبان LowBlock خوانده می‌شود.", "The bot language follows your language setting in LowBlock."],
    help: ["دستورهای LowBlock:\n/matches — مسابقه‌های امروز\n/my_predictions — پیش‌بینی‌های من\n/results — نتایج\n/leaderboard — جدول جهانی\n/profile — پروفایل\n/reminders — یادآوری‌ها\n/language — زبان\n/help — راهنما", "LowBlock commands:\n/matches — Today’s fixtures\n/my_predictions — My predictions\n/results — Results\n/leaderboard — Global leaderboard\n/profile — Profile\n/reminders — Reminders\n/language — Language\n/help — Help"],
  };
  await send(chatId, language === "fa" ? messages[command][0] : messages[command][1], buttons[command]);
}

function connectKeyboard(): InlineKeyboard { return { inline_keyboard: [[greenButton({ text: "🔗 Connect LowBlock", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/profile` } })]] }; }
function mainKeyboard(language: "fa" | "en"): InlineKeyboard { return { inline_keyboard: [[greenButton({ text: language === "fa" ? "⚽ مسابقه‌ها" : "⚽ Matches", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/matches` } }), greenButton({ text: language === "fa" ? "🏆 جدول" : "🏆 Leaderboard", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/leaderboard` } })], [greenButton({ text: language === "fa" ? "👤 پروفایل" : "👤 Profile", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/profile` } })]] }; }
async function getTelegramIdentity(providerUserId: string) { return (await getDb()).collection<any>("externalIdentities").findOne({ provider: "TELEGRAM", providerUserId }, { projection: { userId: 1 } }); }

async function sendLeaderboard(chatId: string, providerUserId: string) {
  const db = await getDb();
  const identity = await db.collection<any>("externalIdentities").findOne({ provider: "TELEGRAM", providerUserId }, { projection: { userId: 1 } });
  if (!identity?.userId) { await send(chatId, "برای مشاهده جدول جهانی، ابتدا حساب تلگرام خود را به LowBlock متصل کنید.\n\nConnect your Telegram account to LowBlock first to view the global leaderboard.", true); return; }
  const language = await userLanguage(String(identity.userId));
  const latest = await db.collection<any>("matches").findOne({}, { sort: { seasonStartYear: -1 }, projection: { seasonStartYear: 1 } });
  const year = Number(latest?.seasonStartYear ?? new Date().getUTCFullYear());
  const rows = await getCanonicalLeaderboard(db, { seasonStartYear: year }, 10);
  const mine = rows.find((row) => row.userId === String(identity.userId));
  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.length ? rows.map((row, index) => `${medals[index] ?? `${index + 1}.`} <b>${escapeHtml(row.username)}</b>  <code>${row.points} ${language === "fa" ? "امتیاز" : "pts"}</code>`).join("\n") : "—";
  const header = language === "fa" ? `🏆 <b>جدول جهانی LowBlock</b>\n<i>فصل ${year}/${String(year + 1).slice(-2)} · ۱۰ نفر برتر</i>\n\n` : `🏆 <b>LowBlock Global Leaderboard</b>\n<i>Season ${year}/${String(year + 1).slice(-2)} · Top 10</i>\n\n`;
  const position = mine ? (language === "fa" ? `\n\n📍 <b>رتبه شما:</b> <code>#${mine.rank}</code> · ${mine.points} امتیاز` : `\n\n📍 <b>Your rank:</b> <code>#${mine.rank}</code> · ${mine.points} pts`) : "";
  await send(chatId, `${header}${lines}${position}`, true);
}

async function userForToken(token: string) { const { createHash } = await import("node:crypto"); const row = await getDb().then((db) => db.collection<{ userId: string }>("accountLinkTokens").findOne({ tokenHash: createHash("sha256").update(token).digest("hex"), provider: "TELEGRAM", usedAt: null, expiresAt: { $gt: new Date() } }, { projection: { userId: 1 } })); if (!row) throw Error("LINK_TOKEN_INVALID"); return row.userId; }
async function userLanguage(userId: string) { const row = await getDb().then((db) => db.collection<{ language?: string }>("notificationPreferences").findOne({ userId }, { projection: { language: 1 } })); return row?.language === "en" ? "en" : "fa" as "fa" | "en"; }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
async function send(chatId: string, text: string, keyboard: boolean | InlineKeyboard = false) {
  if (!env.TELEGRAM_BOT_TOKEN) return;

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: keyboard === true ? { inline_keyboard: [[greenButton({ text: "🏆 Leaderboard", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/lowblock` } }), greenButton({ text: "⚽ Predict", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/matches` } })]] } : keyboard || undefined,
    }),
  });

  const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !result?.ok) {
    console.error("Telegram sendMessage failed", { status: response.status, description: result?.description });
  }
}
