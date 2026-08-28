import { describe, expect, it, beforeEach } from "vitest";
import { signGuestReceipt, verifyGuestReceipt } from "@/lib/predictions/guestReceipt";

beforeEach(() => { process.env.GUEST_PREDICTION_SIGNING_SECRET = "test-guest-receipt-secret-123456"; });
describe("guest prediction receipts", () => {
  it("signs and verifies a prediction envelope", () => { const receipt = signGuestReceipt({ matchId: "fixture-1", homeGoals: 2, awayGoals: 1, issuedAt: Date.now() }); expect(verifyGuestReceipt(receipt)).toMatchObject({ matchId: "fixture-1", homeGoals: 2, awayGoals: 1 }); });
  it("rejects a tampered envelope", () => { const receipt = signGuestReceipt({ matchId: "fixture-1", homeGoals: 2, awayGoals: 1, issuedAt: Date.now() }); const [body, signature] = receipt.split("."); const tampered = `${Buffer.from(JSON.stringify({ v: 1, matchId: "fixture-2", homeGoals: 9, awayGoals: 9, issuedAt: Date.now(), nonce: "x" })).toString("base64url")}.${signature}`; expect(verifyGuestReceipt(tampered)).toBeNull(); expect(verifyGuestReceipt(`${body}.${signature.slice(0, -1)}x`)).toBeNull(); });
  it("rejects invalid score values", () => { const receipt = signGuestReceipt({ matchId: "fixture-1", homeGoals: 2, awayGoals: 1, issuedAt: Date.now() }); const [body, signature] = receipt.split("."); const payload = JSON.parse(Buffer.from(body, "base64url").toString()); payload.homeGoals = 31; const invalid = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`; expect(verifyGuestReceipt(invalid)).toBeNull(); });
});
