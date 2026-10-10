import { describe, expect, it } from "vitest";
import { selectActiveRound } from "../lib/football/rounds";

describe("active round selection", () => {
  it("chooses the earliest upcoming round, not an older postponed round", () => {
    const now = Date.parse("2026-10-10T12:00:00.000Z");
    expect(
      selectActiveRound([
        { number: 6, completed: false, nextKickoffAt: null },
        { number: 8, completed: false, nextKickoffAt: Date.parse("2026-10-10T19:00:00.000Z") },
        { number: 12, completed: false, nextKickoffAt: null },
      ], now),
    ).toBe(8);
  });

  it("prefers a live round over a later scheduled round", () => {
    const now = Date.parse("2026-10-10T12:00:00.000Z");
    expect(
      selectActiveRound([
        { number: 8, live: true, completed: false, nextKickoffAt: null },
        { number: 9, completed: false, nextKickoffAt: now + 60_000 },
      ], now),
    ).toBe(8);
  });
});
