import { createHash, randomBytes } from "node:crypto";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const AWARD_SHARE_TOKEN_LENGTH = 6;
export function createAwardShareToken() { const bytes = randomBytes(AWARD_SHARE_TOKEN_LENGTH); return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(""); }
export function hashAwardShareToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
