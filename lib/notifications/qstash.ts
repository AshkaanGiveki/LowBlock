import { Client, Receiver } from "@upstash/qstash";
import { env } from "@/lib/env";

export function qstashConfigStatus() {
  const missing: string[] = [];
  if (!env.QSTASH_TOKEN) missing.push("QSTASH_TOKEN");
  if (!env.QSTASH_CURRENT_SIGNING_KEY)
    missing.push("QSTASH_CURRENT_SIGNING_KEY");
  if (!env.NEXT_PUBLIC_APP_URL || /localhost|127\\.0\\.0\\.1/.test(env.NEXT_PUBLIC_APP_URL))
    missing.push("NEXT_PUBLIC_APP_URL");
  return { configured: missing.length === 0, missing };
}

export function getQstashClient() {
  const status = qstashConfigStatus();
  if (!status.configured)
    throw new Error(`QSTASH_NOT_CONFIGURED:${status.missing.join(",")}`);
  return new Client({ token: env.QSTASH_TOKEN! });
}

export async function scheduleMatchReminder(matchId: string, runAt: Date) {
  await getQstashClient().publishJSON({
    url: `${env.NEXT_PUBLIC_APP_URL}/api/notifications/match-reminder`,
    body: { matchId },
    notBefore: Math.floor(runAt.getTime() / 1000),
    deduplicationId: `lowblock-match-reminder-${matchId}`,
  });
  return true;
}
export async function verifyQstashSignature(
  body: string,
  signature: string | null,
  url?: string,
) {
  if (!signature || !env.QSTASH_CURRENT_SIGNING_KEY) return false;
  try {
    return await new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    }).verify({ signature, body, url });
  } catch {
    return false;
  }
}
