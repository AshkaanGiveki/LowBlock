import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDb, mockScore } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockScore: vi.fn().mockResolvedValue({ matches: 2 }),
}));
vi.mock("@/lib/db/mongo", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/scoring/scoreEngine", () => ({ runScoreEngine: mockScore }));

import { flushFinishedMatchScoring, queueFinishedMatchScoring } from "@/lib/football/sportsapi/scoringBatch";

describe("finished-match scoring batching", () => {
  const leases = {
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    findOneAndUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-11-15T12:00:00.000Z") });
    mockGetDb.mockReset();
    mockScore.mockClear();
    leases.findOneAndUpdate.mockReset();
    mockGetDb.mockResolvedValue({
      collection: () => leases,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("retries instead of dropping a batch when another worker owns the scoring lease", async () => {
    leases.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async (_filter: unknown, update: any) => ({ owner: update.$set.owner }));
    queueFinishedMatchScoring();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mockScore).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockScore).toHaveBeenCalledTimes(1);
  });

  it("does not drop matches queued during an in-progress scoring run", async () => {
    let finish!: () => void;
    mockScore.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    leases.findOneAndUpdate.mockImplementation(async (_filter: unknown, update: any) => ({ owner: update.$set.owner }));
    const first = flushFinishedMatchScoring();
    await vi.advanceTimersByTimeAsync(0);
    queueFinishedMatchScoring();
    finish();
    await first;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mockScore).toHaveBeenCalledTimes(2);
  });
});
