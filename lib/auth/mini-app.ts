import { createHmac, timingSafeEqual } from "node:crypto";

export type MiniAppProvider = "telegram" | "bale";

export type MiniAppUser = {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
};

export type VerifiedMiniAppData = {
  provider: MiniAppProvider;
  user: MiniAppUser;
  authDate: Date;
  queryId?: string;
};

export class MiniAppAuthError extends Error {
  constructor(message: string, public readonly code: "INVALID_DATA" | "EXPIRED_DATA" | "MISSING_USER") {
    super(message);
  }
}

function safeHexEqual(left: string, right: string) {
  if (!/^[a-f\d]{64}$/i.test(left) || !/^[a-f\d]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

/** Validates Telegram WebApp initData. Bale currently uses the same signed initData envelope. */
export function verifyMiniAppInitData(
  provider: MiniAppProvider,
  initData: string,
  botToken: string,
  options: { now?: Date; maxAgeSeconds?: number } = {},
): VerifiedMiniAppData {
  if (!initData || !botToken) throw new MiniAppAuthError("Mini App credentials are missing", "INVALID_DATA");
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash") ?? "";
  params.delete("hash");
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secret).update(checkString).digest("hex");
  if (!safeHexEqual(suppliedHash, expectedHash)) throw new MiniAppAuthError("Mini App signature is invalid", "INVALID_DATA");

  const authDateSeconds = Number(params.get("auth_date"));
  if (!Number.isSafeInteger(authDateSeconds)) throw new MiniAppAuthError("Mini App auth date is invalid", "INVALID_DATA");
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const maxAge = options.maxAgeSeconds ?? 600;
  if (authDateSeconds > nowSeconds + 30 || nowSeconds - authDateSeconds > maxAge) {
    throw new MiniAppAuthError("Mini App launch data has expired", "EXPIRED_DATA");
  }

  let rawUser: Record<string, unknown>;
  try {
    rawUser = JSON.parse(params.get("user") ?? "null") as Record<string, unknown>;
  } catch {
    throw new MiniAppAuthError("Mini App user is invalid", "MISSING_USER");
  }
  if (!rawUser || (typeof rawUser.id !== "number" && typeof rawUser.id !== "string") || typeof rawUser.first_name !== "string") {
    throw new MiniAppAuthError("Mini App user is missing", "MISSING_USER");
  }
  return {
    provider,
    authDate: new Date(authDateSeconds * 1000),
    queryId: params.get("query_id") ?? undefined,
    user: {
      id: String(rawUser.id),
      firstName: rawUser.first_name,
      lastName: typeof rawUser.last_name === "string" ? rawUser.last_name : undefined,
      username: typeof rawUser.username === "string" ? rawUser.username : undefined,
      languageCode: typeof rawUser.language_code === "string" ? rawUser.language_code : undefined,
      photoUrl: typeof rawUser.photo_url === "string" ? rawUser.photo_url : undefined,
    },
  };
}

export function miniAppToken(provider: MiniAppProvider) {
  return provider === "telegram" ? process.env.TELEGRAM_BOT_TOKEN : process.env.BALE_BOT_TOKEN;
}
