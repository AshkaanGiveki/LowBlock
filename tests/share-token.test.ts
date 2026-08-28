import { describe, expect, it } from "vitest";
import { AWARD_SHARE_TOKEN_LENGTH, createAwardShareToken, hashAwardShareToken } from "@/lib/awards/shareToken";
describe("award share tokens", () => { it("creates compact URL-safe tokens and stores only their hash", () => { const token = createAwardShareToken(); expect(token).toHaveLength(AWARD_SHARE_TOKEN_LENGTH); expect(token).toMatch(/^[A-Za-z0-9_-]+$/); expect(hashAwardShareToken(token)).not.toContain(token); }); });
