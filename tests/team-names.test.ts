import { describe, expect, it } from "vitest";
import { teamName } from "@/lib/football/team-names";

describe("teamName translations", () => {
  it("returns correct Persian names", () => {
    expect(teamName("fa", 4719, "Australia")).toBe("استرالیا");
    expect(teamName("fa", 4748, "Brazil")).toBe("برزیل");
    expect(teamName("fa", 4698, "Spain")).toBe("اسپانیا");
    expect(teamName("fa", 1, "Arsenal")).toBe("آرسنال");
    expect(teamName("fa", 2, "Liverpool")).toBe("لیورپول");
    expect(teamName("fa", 3, "Real Madrid")).toBe("رئال مادرید");
  });

  it("keeps English names unchanged", () => {
    expect(teamName("en", 4719, "Australia")).toBe("Australia");
    expect(teamName("en", 1, "Arsenal")).toBe("Arsenal");
  });

  it("does not use football-api IDs for SportsAPI teams", () => {
    expect(teamName("fa", 1, "Unknown SportsAPI Club", "sportsapi")).toBe("Unknown SportsAPI Club");
  });
});
