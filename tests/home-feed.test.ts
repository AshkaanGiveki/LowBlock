import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  currentUserId: vi.fn(),
  getMatchesPage: vi.fn(),
  getDb: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ currentUserId: mocks.currentUserId }));
vi.mock("@/lib/db/mongo", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/football/data", () => ({
  getMatchesPage: mocks.getMatchesPage,
  getLatestSeasonStartYear: vi.fn(),
}));
vi.mock("@/lib/domain/leaderboards", () => ({
  getLeaderboardSummary: vi.fn(),
  getCachedCanonicalLeaderboard: vi.fn(),
}));
vi.mock("@/lib/domain/h2h", () => ({ getViewerH2HTodayMatch: vi.fn() }));
import { GET } from "@/app/api/home/route";
const match = { providerMatchId: "next-open-match" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUserId.mockResolvedValue(null);
  mocks.getMatchesPage.mockResolvedValue({ matches: [match] });
});
describe("home prediction feed", () => {
  it("requests five eligible matches before pagination for guests", async () => {
    const response = await GET(new Request("https://lowblock.ir/api/home"));
    expect(mocks.getMatchesPage).toHaveBeenCalledWith(5, null, {
      upcomingOnly: true,
      unpredictedFor: undefined,
    });
    expect(await response.json()).toMatchObject({
      matches: [match],
      allPredicted: false,
    });
  });
  it("excludes the viewer's saved predictions before limiting the feed", async () => {
    mocks.currentUserId.mockResolvedValue("507f1f77bcf86cd799439011");
    const response = await GET(
      new Request("https://lowblock.ir/api/home?fixturesOnly=1"),
    );
    expect(mocks.getMatchesPage).toHaveBeenCalledWith(5, null, {
      upcomingOnly: true,
      unpredictedFor: "507f1f77bcf86cd799439011",
    });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect((await response.json()).matches).toEqual([match]);
  });
  it("distinguishes all-predicted from an empty schedule", async () => {
    mocks.currentUserId.mockResolvedValue("507f1f77bcf86cd799439011");
    mocks.getMatchesPage
      .mockResolvedValueOnce({ matches: [] })
      .mockResolvedValueOnce({ matches: [match] });
    const response = await GET(
      new Request("https://lowblock.ir/api/home?fixturesOnly=1"),
    );
    expect((await response.json()).allPredicted).toBe(true);
    mocks.getMatchesPage.mockResolvedValue({ matches: [] });
    expect(
      (
        await (
          await GET(new Request("https://lowblock.ir/api/home?fixturesOnly=1"))
        ).json()
      ).allPredicted,
    ).toBe(false);
  });
  it("keeps fixtures available when optional dashboard data fails", async () => {
    mocks.currentUserId.mockResolvedValue("507f1f77bcf86cd799439011");
    mocks.getDb.mockRejectedValue(new Error("rankings unavailable"));
    const response = await GET(new Request("https://lowblock.ir/api/home"));
    expect(response.status).toBe(200);
    expect((await response.json()).matches).toEqual([match]);
  });
  it("returns an error status when fixtures fail instead of a false empty feed", async () => {
    mocks.getMatchesPage.mockRejectedValue(new Error("db unavailable"));
    const response = await GET(new Request("https://lowblock.ir/api/home"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Fixtures unavailable" });
  });
});
