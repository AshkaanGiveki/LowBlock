import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";

type Provider = "telegram" | "bale";
type ReminderScope = "ALL_MATCHES" | "GLOBAL_LEADERBOARD";
const field = (provider: Provider) => provider === "telegram" ? "telegramPredictionRemindersEnabled" : "balePredictionRemindersEnabled";
const normalize = (value: unknown): Provider | null => value === "telegram" || value === "bale" ? value : null;
const normalizeScope = (value: unknown): ReminderScope | null => value === "ALL_MATCHES" || value === "GLOBAL_LEADERBOARD" ? value : null;

export async function GET() {
  const userId = await currentUserId(); if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const db = await getDb(); const [preferences, identities] = await Promise.all([
    db.collection<any>("notificationPreferences").findOne({ userId }),
    db.collection<any>("externalIdentities").find({ userId, provider: { $in: ["TELEGRAM", "BALE"] } }, { projection: { provider: 1 } }).toArray(),
  ]);
  const connected = { telegram: identities.some(row => row.provider === "TELEGRAM"), bale: identities.some(row => row.provider === "BALE") };
  const enabled = { telegram: connected.telegram && preferences?.telegramPredictionRemindersEnabled !== false, bale: connected.bale && preferences?.balePredictionRemindersEnabled !== false };
  return NextResponse.json({ enabled: enabled.telegram, language: preferences?.language === "en" ? "en" : "fa", connected, providers: enabled, telegramReminderScope: preferences?.telegramReminderScope === "GLOBAL_LEADERBOARD" ? "GLOBAL_LEADERBOARD" : "ALL_MATCHES" });
}

export async function PUT(req: Request) {
  const userId = await currentUserId(); if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const input = await req.json().catch(() => null) as { provider?: unknown; enabled?: unknown; language?: unknown; reminderScope?: unknown } | null;
  const provider = normalize(input?.provider) ?? "telegram"; const update: Record<string, unknown> = { userId, updatedAt: new Date() };
  if (input?.language === "fa" || input?.language === "en") update.language = input.language;
  if (typeof input?.enabled === "boolean") {
    const identity = await (await getDb()).collection("externalIdentities").findOne({ userId, provider: provider.toUpperCase() });
    if (!identity) return NextResponse.json({ error: `${provider.toUpperCase()}_NOT_CONNECTED` }, { status: 409 });
    update[field(provider)] = input.enabled;
  }
  const reminderScope = normalizeScope(input?.reminderScope);
  if (reminderScope) {
    if (provider !== "telegram") return NextResponse.json({ error: "TELEGRAM_ONLY" }, { status: 400 });
    const identity = await (await getDb()).collection("externalIdentities").findOne({ userId, provider: "TELEGRAM" });
    if (!identity) return NextResponse.json({ error: "TELEGRAM_NOT_CONNECTED" }, { status: 409 });
    if (input?.enabled === false || (input?.enabled === undefined && (await (await getDb()).collection<any>("notificationPreferences").findOne({ userId }))?.telegramPredictionRemindersEnabled === false)) return NextResponse.json({ error: "TELEGRAM_REMINDERS_DISABLED" }, { status: 409 });
    update.telegramReminderScope = reminderScope;
  }
  await (await getDb()).collection("notificationPreferences").updateOne({ userId }, { $set: update, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true, provider, enabled: typeof update[field(provider)] === "boolean" ? update[field(provider)] : undefined, language: update.language });
}
