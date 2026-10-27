import { describe, expect, it } from "vitest";
import {
  identitySlotConflict,
  makePendingPlatformCookie,
  readPending,
} from "@/lib/platform/identity";
describe("platform linking security", () => {
  it("round trips a signed pending identity", () => {
    const raw = makePendingPlatformCookie(
      { id: "123", username: "player" },
      "TELEGRAM",
    );
    expect(readPending(raw)?.user.id).toBe("123");
    expect(readPending(`${raw}x`)).toBeNull();
  });
  it("allows one identity per provider slot", () => {
    expect(
      identitySlotConflict(undefined, "user-a", undefined, "telegram-1"),
    ).toBe(false);
    expect(
      identitySlotConflict("user-b", "user-a", undefined, "telegram-1"),
    ).toBe(true);
    expect(
      identitySlotConflict(undefined, "user-a", "telegram-2", "telegram-1"),
    ).toBe(true);
    expect(
      identitySlotConflict("user-a", "user-a", "telegram-1", "telegram-1"),
    ).toBe(false);
  });
});
