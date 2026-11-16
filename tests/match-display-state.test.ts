import { describe, expect, it } from "vitest";
import { matchDisplayState } from "@/lib/football/matchDisplayState";
const now = Date.parse("2026-11-16T20:00:00Z");
describe("match list live/result status", () => {
  it("recognizes provider live states", () => {
    for (const status of ["LIVE", "1H", "2H", "HT", "ET", "PEN", "PAUSED"]) {
      expect(matchDisplayState({ status }, now)).toMatchObject({ live: true, finished: false, started: true });
    }
  });
  it("never fabricates a final score from a stale kickoff", () => {
    expect(matchDisplayState({ status: "SCHEDULED", kickoffAt: "2026-11-16T12:00:00Z" }, now))
      .toEqual({ live: false, finished: false, started: true });
  });
  it("does not label postponed fixtures live or final", () => {
    expect(matchDisplayState({ status: "POSTPONED", kickoffAt: "2026-11-16T12:00:00Z" }, now))
      .toEqual({ live: false, finished: false, started: false });
  });
  it("places verified final matches in results", () => {
    expect(matchDisplayState({ status: "FINISHED" }, now))
      .toMatchObject({ live: false, finished: true, started: true });
  });
});
