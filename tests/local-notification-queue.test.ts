import { describe, expect, it } from "vitest";
import { enqueueLocalNotificationJob } from "@/lib/notifications/localQueue";

describe("local notification queue", () => {
  it("uses the job key as an idempotency key", async () => {
    const seen = new Set<string>();
    const db = {
      collection: () => ({
        updateOne: async (filter: { jobKey: string }) => {
          if (seen.has(filter.jobKey)) return { upsertedCount: 0 };
          seen.add(filter.jobKey);
          return { upsertedCount: 1 };
        },
      }),
    } as any;

    const input = {
      jobKey: "match-reminder:123",
      type: "MATCH_REMINDER" as const,
      runAt: new Date("2026-10-27T01:00:00.000Z"),
      payload: { matchId: "123" },
    };
    expect(await enqueueLocalNotificationJob(db, input)).toBe(true);
    expect(await enqueueLocalNotificationJob(db, input)).toBe(false);
  });
});
