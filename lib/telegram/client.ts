import { env } from "@/lib/env";

type TelegramResponse<T = unknown> = {
  ok?: boolean;
  description?: string;
  result?: T;
};

const relay = () => env.TELEGRAM_RELAY_URL?.replace(/\/$/, "");

export function telegramEnabled() {
  return Boolean(env.TELEGRAM_BOT_TOKEN || relay());
}

export async function telegramApi<T = unknown>(
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const relayUrl = relay();
  const response = relayUrl
    ? await fetch(`${relayUrl}/telegram/${encodeURIComponent(method)}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(env.TELEGRAM_RELAY_SECRET
            ? { "x-lowblock-relay-secret": env.TELEGRAM_RELAY_SECRET }
            : {}),
        },
        body: JSON.stringify(params),
      })
    : await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
      });
  const body = (await response.json().catch(() => null)) as TelegramResponse<T> | null;
  if (!response.ok || !body?.ok)
    throw new Error(body?.description || `TELEGRAM_${response.status}`);
  return body.result as T;
}
