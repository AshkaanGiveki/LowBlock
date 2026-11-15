import { describe, it, expect } from "vitest";
import { centralTeamLogo } from "@/lib/football/centralTeams";
import { nationalTeamCrestUrl, nationalTeamCrestSlug, teamLogoFile, footballApiTeamLogoUrl } from "@/lib/football/teamLogos";

describe("football association crests and provider-specific clubs", () => {
  it("maps national teams to verified crest slugs instead of flags", () => {
    expect(nationalTeamCrestUrl("Germany")).toBe("/api/team-logo/national-germany-national-team");
    expect(nationalTeamCrestUrl("Netherlands")).toBe("/api/team-logo/national-netherlands-national-team-dutch");
    expect(nationalTeamCrestSlug("Côte d'Ivoire")).toBe("cote-d-ivoire-national-team");
    expect(nationalTeamCrestSlug("Türkiye")).toBe("turkey-national-team");
    expect(nationalTeamCrestUrl("Cook Islands")).toBeNull();
  });
  it("never uses an existing flag URL for a national team", () => {
    expect(centralTeamLogo({
      names:{en:"Germany",fa:"آلمان"}, isNational:true,
      logoUrl:"https://flagcdn.com/w160/de.png",
      providerIds:{sportsapi:"4711","football-api":"25"}
    })).toBe("/api/team-logo/national-germany-national-team");
  });
  it("keeps provider IDs isolated and rejects path traversal", () => {
    expect(centralTeamLogo({
      names:{en:"Ipswich",fa:""},isNational:false,logoUrl:null,
      providerIds:{"football-api":"57"}
    })).toBe(footballApiTeamLogoUrl("57"));
    expect(teamLogoFile("national-../bad")).toBeNull();
    expect(teamLogoFile("football-api-0")).toBeNull();
  });
});
