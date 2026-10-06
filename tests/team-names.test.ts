import { describe, expect, it } from "vitest";
import { teamName } from "@/lib/football/team-names";

describe("teamName translations", () => {
  it("translates national teams accurately to Persian", () => {
    expect(teamName("fa", 4719, "Australia")).toBe("استرالیا");
    expect(teamName("fa", 4748, "Brazil")).toBe("برزیل");
    expect(teamName("fa", 4698, "Spain")).toBe("اسپانیا");
    expect(teamName("fa", 4700, "Croatia")).toBe("کرواسی");
    expect(teamName("fa", 1234, "Russia")).toBe("روسیه");
    expect(teamName("fa", 5678, "Iran")).toBe("ایران");
    expect(teamName("fa", 9999, "England")).toBe("انگلیس");
    expect(teamName("fa", 8888, "France")).toBe("فرانسه");
  });

  it("translates major clubs accurately to Persian", () => {
    expect(teamName("fa", 1, "Arsenal")).toBe("آرسنال");
    expect(teamName("fa", 2, "Liverpool")).toBe("لیورپول");
    expect(teamName("fa", 3, "Real Madrid")).toBe("رئال مادرید");
    expect(teamName("fa", 4, "Barcelona")).toBe("بارسلونا");
    expect(teamName("fa", 5, "Manchester City")).toBe("منچسترسیتی");
  });

  it("preserves English name when language is en", () => {
    expect(teamName("en", 4719, "Australia")).toBe("Australia");
    expect(teamName("en", 4748, "Brazil")).toBe("Brazil");
    expect(teamName("en", 1, "Arsenal")).toBe("Arsenal");
  });
});
