import { describe, expect, it } from "vitest";
import { matchTabFor } from "@/lib/football/matchState";
const now = Date.parse("2026-11-22T12:00:00Z");
const fixture = (status: string, kickoffAt = "2026-11-22T13:00:00Z") => ({
  status,
  kickoffAt,
});
describe("match tab eligibility", () => {
  it("only opens scheduled future fixtures for predictions", () => {
    expect(matchTabFor(fixture("SCHEDULED"), now)).toBe("open");
    expect(
      matchTabFor(fixture("SCHEDULED", new Date(now).toISOString()), now),
    ).toBe("live");
  });
  it("keeps live and suspended matches out of both upcoming and results", () => {
    expect(matchTabFor(fixture("LIVE"), now)).toBe("live");
    expect(matchTabFor(fixture("SUSPENDED"), now)).toBe("live");
  });
  it("does not fabricate a final result after two hours", () => {
    expect(matchTabFor(fixture("LIVE", "2026-11-22T08:00:00Z"), now)).toBe(
      "live",
    );
    expect(matchTabFor(fixture("FINISHED"), now)).toBe("started");
  });
  it.each(["POSTPONED", "CANCELLED", "VOID", "UNKNOWN"])(
    "excludes %s",
    (status) => {
      expect(matchTabFor(fixture(status), now)).toBeNull();
    },
  );
  it("ignores invalid scheduled kickoffs", () =>
    expect(matchTabFor(fixture("SCHEDULED", "invalid"), now)).toBeNull());
});
