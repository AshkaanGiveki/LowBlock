import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDb, mockReadCachedLive } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockReadCachedLive: vi.fn(),
}));
vi.mock("@/lib/db/mongo", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/football/intelligence/liveCache", () => ({
  readCachedLiveMatch: mockReadCachedLive,
}));
import { GET } from "@/app/api/matches/[matchId]/intelligence/route";

const match = {
  provider: "sportsapi",
  providerMatchId: "777",
  status: "LIVE",
  kickoffAt: "2026-11-15T12:00:00.000Z",
  homeTeam: { id: 1, name: "Home" },
  awayTeam: { id: 2, name: "Away" },
  homeGoals: 1,
  awayGoals: 0,
};
function request(etag?: string) {
  return new Request("http://localhost/api/matches/777/intelligence", {
    headers: etag ? { "If-None-Match": etag } : {},
  });
}
const params = { params: Promise.resolve({ matchId: "777" }) };

describe("quota-free Match Intelligence reader", () => {
  let calls: string[];
  beforeEach(() => {
    calls = [];
    mockGetDb.mockReset();
    mockReadCachedLive.mockReset();
    mockReadCachedLive.mockResolvedValue({
      provider: "sportsapi",
      score: { home: 1, away: 0, status: "LIVE", elapsed: 35 },
      stats: [], incidents: [], lineups: null,
      updatedAt: "2026-11-15T12:30:00Z",
    });
    mockGetDb.mockResolvedValue({
      collection: (name: string) => ({
        find: () => ({ limit: () => ({ toArray: async () => name === "footballMatchIntelligence" ? [{ matchId: "777", provider: "sportsapi", local: { form: { home: [{ result: "W" }], away: [] }, h2h: [] } }] : [] }) }),
        findOne: async () => {
          calls.push(name);
          if (name === "matches") return match;
          return null;
        },
      }),
    });
  });

  it("reads cached football snapshots without querying matchDetails or contacting SportsAPI", async () => {
    const response = await GET(request(), params);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.live.score.home).toBe(1);
    expect(data.availability.form).toBe(true);
    expect(data.availability.standings).toBe(false);
    expect(calls).not.toContain("matchDetails");
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it("returns 304 for an unchanged cached match", async () => {
    const first = await GET(request(), params);
    const etag = first.headers.get("etag")!;
    const second = await GET(request(etag), params);
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("never attaches a SportsAPI snapshot to an API-Football ID collision", async () => {
    mockGetDb.mockResolvedValue({
      collection: (name: string) => ({
        findOne: async () => name === "matches" ? { ...match, provider: "football-api" } : null,
        find: () => ({ limit: () => ({ toArray: async () => [{ provider: "sportsapi", local: { form: { home: [{ result: "W" }], away: [] } } }] }) }),
      }),
    });
    const response = await GET(request(), params);
    const payload = await response.json();
    expect(payload.live).toBeNull();
    expect(payload.historical).toBeNull();
  });
});
