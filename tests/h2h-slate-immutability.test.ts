import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { publishH2HSlateOnce } from "@/lib/domain/h2hSlateLock";

const oldSlate = {
  sourceDate: "2026-11-16",
  matchday: 4,
  fixtureIds: ["17364783", "15534056", "15534072", "15534107", "15534117"],
};
const changed = {
  ...oldSlate,
  fixtureIds: ["15534188", "15534056", "15534072", "15534107", "15534117"],
};
describe("published H2H slate immutability", () => {
  it("ignores sync-now changes after users have been shown a slate", async () => {
    const update = vi.fn();
    const db = { collection: vi.fn(() => ({ findOneAndUpdate: update })) } as unknown as Db;
    const league = { _id: "league1", slates: [oldSlate] };
    const result = await publishH2HSlateOnce(db, league, changed);
    expect(result).toEqual({ league, action: "ALREADY_PUBLISHED" });
    expect(db.collection).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(league.slates[0].fixtureIds).toContain("17364783");
  });
  it("allows publishing a genuinely new day, once, with an atomic predicate", async () => {
    const published = { _id: "league1", status: "ACTIVE", slates: [oldSlate, { ...changed, sourceDate: "2026-11-17", matchday: 5 }] };
    const update = vi.fn().mockResolvedValue(published);
    const db = { collection: vi.fn(() => ({ findOneAndUpdate: update })) } as unknown as Db;
    const result = await publishH2HSlateOnce(db, { _id: "league1", slates: [oldSlate] }, {
      ...changed, sourceDate: "2026-11-17", matchday: 5,
    });
    expect(result.action).toBe("PUBLISHED");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "league1", status: "ACTIVE",
        "slates.sourceDate": { $ne: "2026-11-17" },
        "slates.matchday": { $ne: 5 },
      }),
      expect.objectContaining({ $push: expect.anything() }),
      { returnDocument: "after" },
    );
  });
  it("handles a concurrent publisher without overwriting the winner", async () => {
    const fresh = { _id: "league1", status: "ACTIVE", slates: [oldSlate, changed] };
    const update = vi.fn().mockResolvedValue(null);
    const findOne = vi.fn().mockResolvedValue(fresh);
    const db = { collection: vi.fn(() => ({ findOneAndUpdate: update, findOne })) } as unknown as Db;
    const result = await publishH2HSlateOnce(db, { _id: "league1", slates: [] }, changed);
    expect(result.action).toBe("ALREADY_PUBLISHED");
    expect(result.league).toBe(fresh);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("does not publish an invalid day or silently bypass the DB guard", async () => {
    const db = { collection: vi.fn() } as unknown as Db;
    await expect(publishH2HSlateOnce(db, { _id: "league1", slates: [] }, {
      ...changed, matchday: 8,
    })).rejects.toThrow("INVALID_H2H_SLATE");
    expect(db.collection).not.toHaveBeenCalled();
  });
  it("rejects unpublished dates when DB blocks publication for an unexpected reason", async () => {
    const update = vi.fn().mockResolvedValue(null);
    const findOne = vi.fn().mockResolvedValue({ _id: "league1", status: "CANCELLED", slates: [] });
    const db = { collection: vi.fn(() => ({ findOneAndUpdate: update, findOne })) } as unknown as Db;
    await expect(publishH2HSlateOnce(db, { _id: "league1", slates: [] }, changed))
      .rejects.toThrow("H2H_SLATE_PUBLISH_REJECTED");
  });
});
