import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MiniAppAuthError, verifyMiniAppInitData } from "@/lib/auth/mini-app";

const token = "123456:development-test-token";
const now = new Date("2026-08-16T12:00:00.000Z");

function signedInitData(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(now.getTime() / 1000)),
    query_id: "AAE-test-query",
    user: JSON.stringify({ id: "9007199254740991", first_name: "Ashkan", username: "ashkan" }),
    ...overrides,
  });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(checkString).digest("hex"));
  return params.toString();
}

describe("verifyMiniAppInitData", () => {
  it.each(["telegram", "bale"] as const)("validates signed %s launch data", (provider) => {
    const result = verifyMiniAppInitData(provider, signedInitData(), token, { now });
    expect(result.provider).toBe(provider);
    expect(result.user.id).toBe("9007199254740991");
    expect(result.user.username).toBe("ashkan");
  });

  it("rejects tampered user data", () => {
    const params = new URLSearchParams(signedInitData());
    params.set("user", JSON.stringify({ id: 42, first_name: "Attacker" }));
    expect(() => verifyMiniAppInitData("telegram", params.toString(), token, { now })).toThrow(MiniAppAuthError);
  });

  it("rejects replayed launch data", () => {
    const old = String(Math.floor(now.getTime() / 1000) - 601);
    expect(() => verifyMiniAppInitData("telegram", signedInitData({ auth_date: old }), token, { now, maxAgeSeconds: 600 }))
      .toThrowError("Mini App launch data has expired");
  });
});
