import { describe, expect, it } from "vitest";
import { deriveRoundStatus } from "@/lib/football/roundLifecycle";
describe("round lifecycle", () => {
  const now = new Date("2026-08-22T12:00:00Z");
  it("keeps postponed fixtures pending", () => expect(deriveRoundStatus([{ status: "FINISHED", kickoffAt: "2026-08-21T12:00:00Z", homeGoals: 1, awayGoals: 0 }, { status: "POSTPONED", kickoffAt: "2026-08-21T14:00:00Z", homeGoals: null, awayGoals: null }], now).status).toBe("PENDING"));
  it("does not count void fixtures toward finalization", () => expect(deriveRoundStatus([{ status: "FINISHED", kickoffAt: "2026-08-21T12:00:00Z", homeGoals: 1, awayGoals: 0 }, { status: "VOID", kickoffAt: "2026-08-21T14:00:00Z", homeGoals: null, awayGoals: null }], now).status).toBe("FINAL"));
  it("marks suspended play live until resolved", () => expect(deriveRoundStatus([{ status: "SUSPENDED", kickoffAt: "2026-08-21T12:00:00Z", homeGoals: 1, awayGoals: 1 }], now).status).toBe("PENDING"));
});
