import { describe, expect, it } from "vitest";
import { isDailyWorkerWindow, localWorkerClock } from "@/lib/worker/schedule";
import { providerDateKeys } from "@/lib/football/scheduleWindow";

describe("local worker schedule", () => {
  it("uses the application timezone for the 03:30 daily window", () => {
    const instant = new Date("2026-10-27T00:00:00.000Z");
    expect(localWorkerClock(instant, "Asia/Tehran")).toMatchObject({
      dateKey: "2026-10-27",
      hour: 3,
      minute: 30,
    });
    expect(isDailyWorkerWindow(instant, "Asia/Tehran")).toBe(true);
    expect(isDailyWorkerWindow(new Date("2026-10-26T23:29:00.000Z"), "Asia/Tehran")).toBe(false);
    expect(isDailyWorkerWindow(new Date("2026-10-27T00:01:00.000Z"), "Asia/Tehran")).toBe(true);
  });

  it("fetches exactly yesterday, today, and tomorrow", () => {
    expect(providerDateKeys(new Date("2026-10-27T00:00:00.000Z"))).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
  });
});
