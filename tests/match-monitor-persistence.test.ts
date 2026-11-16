import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDb, mockCacheWrite, mockScoring } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockCacheWrite: vi.fn().mockResolvedValue(undefined),
  mockScoring: vi.fn(),
}));
vi.mock("@/lib/db/mongo", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/football/intelligence/liveCache", () => ({ writeCachedLiveMatch: mockCacheWrite }));
vi.mock("@/lib/football/sportsapi/scoringBatch", () => ({ queueFinishedMatchScoring: mockScoring }));

import { getMatchMonitorService } from "@/lib/football/sportsapi/matchMonitor";

describe("WebSocket snapshot persistence", () => {
  const persisted: Array<any> = [];

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-11-15T12:00:00.000Z") });
    persisted.length = 0;
    mockGetDb.mockReset();
    mockCacheWrite.mockClear();
    mockScoring.mockClear();
    mockGetDb.mockResolvedValue({
      collection: (name: string) => ({
        updateOne: async (_filter: unknown, update: any) => {
          if (name === "matchDetails") persisted.push(structuredClone(update.$set));
          return { matchedCount: 1, modifiedCount: 1 };
        },
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes the final score after a throttled update even without another WebSocket event", async () => {
    const monitor = getMatchMonitorService();
    const id = "994401";
    monitor.handleWsMessage(`match:${id}`, {
      data: { status: { type: "inprogress" }, homeScore: { current: 1 }, awayScore: { current: 0 } },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(persisted.at(-1)?.score?.home).toBe(1);
    expect(persisted.at(-1)?.score?.status).toBe("LIVE");

    await vi.advanceTimersByTimeAsync(1_000);
    monitor.handleWsMessage(`match:${id}`, {
      data: { status: { type: "finished" }, homeScore: { current: 2 }, awayScore: { current: 1 } },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(persisted.at(-1)?.score?.status).toBe("LIVE");

    await vi.advanceTimersByTimeAsync(4_100);
    expect(persisted.at(-1)?.score).toMatchObject({
      home: 2, away: 1, status: "FINISHED",
    });
    expect(mockScoring).toHaveBeenCalledTimes(1);
  });
});
