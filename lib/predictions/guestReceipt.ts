import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const GUEST_RECEIPT_VERSION = 1;
export type GuestReceiptPayload = { v: 1; matchId: string; homeGoals: number; awayGoals: number; issuedAt: number; nonce: string };

function secret() { const value = process.env.GUEST_PREDICTION_SIGNING_SECRET ?? env.GUEST_PREDICTION_SIGNING_SECRET ?? process.env.SESSION_SECRET ?? env.SESSION_SECRET; if (!value) throw new Error("Guest prediction signing secret is not configured"); return value; }
function encode(value: string) { return Buffer.from(value).toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }
function signature(body: string) { return createHmac("sha256", secret()).update(body).digest("base64url"); }

export function signGuestReceipt(input: Omit<GuestReceiptPayload, "v" | "nonce">): string {
  const payload: GuestReceiptPayload = { ...input, v: GUEST_RECEIPT_VERSION, nonce: randomUUID() };
  const body = encode(JSON.stringify(payload));
  return `${body}.${signature(body)}`;
}

export function verifyGuestReceipt(token: string): GuestReceiptPayload | null {
  try {
    const [body, supplied] = token.split("."); if (!body || !supplied || supplied.length !== 43) return null;
    const expected = signature(body); if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
    const payload = JSON.parse(decode(body)) as GuestReceiptPayload;
    if (payload.v !== 1 || typeof payload.matchId !== "string" || !Number.isInteger(payload.homeGoals) || !Number.isInteger(payload.awayGoals) || !Number.isInteger(payload.issuedAt) || typeof payload.nonce !== "string") return null;
    if (payload.homeGoals < 0 || payload.homeGoals > 30 || payload.awayGoals < 0 || payload.awayGoals > 30 || payload.issuedAt > Date.now() + 60_000) return null;
    return payload;
  } catch { return null; }
}
