import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET as getPlayerImage } from "@/app/api/player-image/[playerId]/route";
import { GET as getTeamImage } from "@/app/api/team-image/[teamId]/route";

describe("player and team image proxy routes", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("GET /api/player-image/[playerId]", () => {
    it("returns 404 for invalid or non-numeric player ID", async () => {
      const res1 = await getPlayerImage(new Request("http://localhost/api/player-image/invalid"), {
        params: Promise.resolve({ playerId: "invalid" }),
      });
      expect(res1.status).toBe(404);

      const res2 = await getPlayerImage(new Request("http://localhost/api/player-image/0"), {
        params: Promise.resolve({ playerId: "0" }),
      });
      expect(res2.status).toBe(404);
    });

    it("fetches from Sofascore with custom Referer and returns image with 30-day cache", async () => {
      const mockImageBuffer = new Uint8Array([137, 80, 78, 71]).buffer; // PNG magic bytes
      global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("img.sofascore.com/api/v1/player/331209/image")) {
          // Check that proper headers are sent to bypass hotlink protection
          const headers = (init?.headers as Record<string, string>) || {};
          expect(headers["Referer"]).toBe("https://www.sofascore.com/");
          return Promise.resolve(
            new Response(mockImageBuffer, {
              status: 200,
              headers: { "Content-Type": "image/png" },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      const res = await getPlayerImage(new Request("http://localhost/api/player-image/331209"), {
        params: Promise.resolve({ playerId: "331209" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("Cache-Control")).toContain("public, max-age=2592000");

      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(bytes[0]).toBe(137);
      expect(bytes[1]).toBe(80);
    });

    it("returns 404 with short cache when upstream player image is not found", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

      const res = await getPlayerImage(new Request("http://localhost/api/player-image/999999"), {
        params: Promise.resolve({ playerId: "999999" }),
      });

      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    });
  });

  describe("GET /api/team-image/[teamId]", () => {
    it("returns 404 for invalid team ID", async () => {
      const res = await getTeamImage(new Request("http://localhost/api/team-image/xyz"), {
        params: Promise.resolve({ teamId: "xyz" }),
      });
      expect(res.status).toBe(404);
    });

    it("falls back to Sofascore when SportsAPI key is absent and serves image", async () => {
      const mockImageBuffer = new Uint8Array([137, 80, 78, 71]).buffer;
      global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("img.sofascore.com/api/v1/team/2817/image")) {
          const headers = (init?.headers as Record<string, string>) || {};
          expect(headers["Referer"]).toBe("https://www.sofascore.com/");
          return Promise.resolve(
            new Response(mockImageBuffer, {
              status: 200,
              headers: { "Content-Type": "image/png" },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      const res = await getTeamImage(new Request("http://localhost/api/team-image/2817"), {
        params: Promise.resolve({ teamId: "2817" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("Cache-Control")).toContain("public, max-age=2592000");
    });
  });
});
