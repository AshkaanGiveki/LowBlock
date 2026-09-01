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

  return NextResponse.json({ ok: true });
}

function isCommand(text: string, command: string) { const match = text.match(/^\/([a-z0-9_]+)(?:@[a-z0-9_]+)?(?:\s|$)/i); return match?.[1]?.toLowerCase() === command; }

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
async function send(chatId: string, text: string, open = false) { if (!env.TELEGRAM_BOT_TOKEN) return; await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", reply_markup: open ? { inline_keyboard: [[{ text: "🏆 Leaderboard", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/lowblock` } }, { text: "⚽ Predict", web_app: { url: `${env.NEXT_PUBLIC_APP_URL}/matches` } }]] } : undefined }) }); }
