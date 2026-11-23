import { describe, expect, it } from "vitest";
import { lightweightLeaderboardAvatar } from "@/lib/domain/leaderboardAvatar";

describe("leaderboard avatar payloads", () => {
  const id = "507f1f77bcf86cd799439011";
  it("replaces inline base64 images with cacheable avatar URLs", () => {
    const raw = "data:image/png;base64," + "AAA".repeat(25000);
    const url = lightweightLeaderboardAvatar(id, raw);
    expect(url).toBe("/api/public-avatar/" + id);
    expect(url!.length).toBeLessThan(80);
  });
  it("keeps normal public image URLs and empty pictures", () => {
    expect(lightweightLeaderboardAvatar(id, "https://example.com/avatar.png")).toBe("https://example.com/avatar.png");
    expect(lightweightLeaderboardAvatar(id, null)).toBeNull();
  });
  it("does not inline unsupported data types", () => {
    expect(lightweightLeaderboardAvatar(id, "data:image/svg+xml;base64,YQ==")).toBeNull();
    expect(lightweightLeaderboardAvatar(id, "data:text/html;base64,YQ==")).toBeNull();
  });
});
