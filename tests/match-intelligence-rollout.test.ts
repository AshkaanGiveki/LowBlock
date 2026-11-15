import { describe, expect, it } from "vitest";
import { matchIntelligenceRolloutEnabled as enabled } from "@/lib/football/intelligence/rollout";

describe("Match Intelligence release cohort", () => {
  it("is off for everyone when production percentage is missing or zero", () => {
    expect(enabled("user-1", 0)).toBe(false);
    expect(enabled(null, Number.NaN)).toBe(false);
    expect(enabled("user-1", -10)).toBe(false);
  });
  it("is on for every viewer in the isolated preview and at full rollout", () => {
    expect(enabled(null, 0, true)).toBe(true);
    expect(enabled(null, 100)).toBe(true);
    expect(enabled("user-1", 100)).toBe(true);
  });
  it("assigns a stable deterministic cohort and leaves guests out of partial rollout", () => {
    const users = Array.from({ length: 500 }, (_, n) => "release-user-" + n);
    const assigned = users.filter((id) => enabled(id, 25));
    expect(assigned.length).toBeGreaterThan(70);
    expect(assigned.length).toBeLessThan(180);
    expect(users.map((id) => enabled(id, 25))).toEqual(users.map((id) => enabled(id, 25)));
    expect(enabled(null, 25)).toBe(false);
    expect(users.filter((id) => enabled(id, 25)).every((id) => enabled(id, 50))).toBe(true);
  });
});
