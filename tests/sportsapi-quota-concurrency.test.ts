import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));
vi.mock("@/lib/db/mongo", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/env", () => ({
  env: {
    SPORTSAPI_API_KEY: "test-not-a-production-key",
    SPORTSAPI_DAILY_REQUEST_BUDGET: 60,
    SPORTSAPI_DAILY_DISCOVERY_CACHE_TTL: 300,
    SPORTSAPI_BASE_URL: "https://example.invalid",
  },
}));

import { reserveSportsApiQuotaBatch } from "@/lib/football/sportsapi/rest";

describe("cross-worker SportsAPI REST quota reservations", () => {
  let used = 0;
  beforeEach(() => {
    used = 0;
    mockGetDb.mockReset();
    mockGetDb.mockResolvedValue({
      collection: (name: string) => name === "sportsApiRequests"
        ? { countDocuments: async () => 0 }
        : {
          updateOne: async () => ({ acknowledged: true }),
          findOneAndUpdate: async (filter: any, update: any) => {
            // One atomic findOneAndUpdate; concurrent callers cannot read the
            // same previous value and independently pass the cap.
            if (used > filter.used.$lte) return null;
            used += update.$inc.used;
            return { used };
          },
        },
    });
  });

  it("preserves forty provider requests under 100 simultaneous callers", async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () => reserveSportsApiQuotaBatch(1)),
    );
    expect(results.filter((item) => item.allowed)).toHaveLength(60);
    expect(used).toBe(60);
    expect(results.slice(60).every((item) => !item.allowed)).toBe(true);
  });

  it("accounts for six hosted attempts in the same budget as fifty-four app calls", async () => {
    expect((await reserveSportsApiQuotaBatch(6, "github-hosted-daily")).allowed).toBe(true);
    const results = await Promise.all(
      Array.from({ length: 60 }, () => reserveSportsApiQuotaBatch(1)),
    );
    expect(results.filter((item) => item.allowed)).toHaveLength(54);
    expect(used).toBe(60);
  });

  it("fails closed when the shared reservation database is unavailable", async () => {
    mockGetDb.mockRejectedValueOnce(new Error("unavailable"));
    const response = await reserveSportsApiQuotaBatch(1);
    expect(response).toMatchObject({ allowed: false, unavailable: true });
  });

  it("rejects invalid or unbounded provider request reservations", async () => {
    await expect(reserveSportsApiQuotaBatch(0)).rejects.toThrow(RangeError);
    await expect(reserveSportsApiQuotaBatch(61)).rejects.toThrow(RangeError);
  });
});
