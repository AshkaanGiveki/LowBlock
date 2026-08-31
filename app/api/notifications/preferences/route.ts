import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongo";

type Provider = "telegram" | "bale";
const field = (provider: Provider) => provider === "telegram" ? "telegramPredictionRemindersEnabled" : "balePredictionRemindersEnabled";
const normalize = (value: unknown): Provider | null => value === "telegram" || value === "bale" ? value : null;

export async function GET() {
  const userId = await currentUserId(); if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const db = await getDb(); const [preferences, identities] = await Promise.all([
    db.collection<any>("notificationPreferences").findOne({ userId }),
    db.collection<any>("externalIdentities").find({ userId, provider: { $in: ["TELEGRAM", "BALE"] } }, { projection: { provider: 1 } }).toArray(),
  ]);
  const connected = { telegram: identities.some(row => row.provider === "TELEGRAM"), bale: identities.some(row => row.provider === "BALE") };
  const enabled = { telegram: connected.telegram && preferences?.telegramPredictionRemindersEnabled !== false, bale: connected.bale && preferences?.balePredictionRemindersEnabled !== false };
  return NextResponse.json({ enabled: enabled.telegram, language: preferences?.language === "en" ? "en" : "fa", connected, providers: enabled });
}

export async function PUT(req: Request) {
  const userId = await currentUserId(); if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const input = await req.json().catch(() => null) as { provider?: unknown; enabled?: unknown; language?: unknown } | null;
  const provider = normalize(input?.provider) ?? "telegram"; const update: Record<string, unknown> = { userId, updatedAt: new Date() };
  if (input?.language === "fa" || input?.language === "en") update.language = input.language;
  if (typeof input?.enabled === "boolean") {
    const identity = await (await getDb()).collection("externalIdentities").findOne({ userId, provider: provider.toUpperCase() });
    if (!identity) return NextResponse.json({ error: `${provider.toUpperCase()}_NOT_CONNECTED` }, { status: 409 });
    update[field(provider)] = input.enabled;
  }
  await (await getDb()).collection("notificationPreferences").updateOne({ userId }, { $set: update, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true, provider, enabled: typeof update[field(provider)] === "boolean" ? update[field(provider)] : undefined, language: update.language });
}
