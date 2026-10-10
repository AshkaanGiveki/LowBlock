import { describe, expect, it } from "vitest";
import {
  getLeagueCodeFromSportsApi,
  getSportsApiUniqueTournamentId,
} from "../lib/football/competitionMapping";

describe("SportsAPI competition mappings", () => {
  it("uses the provider IDs for Iran and Saudi Pro League", () => {
    expect(getSportsApiUniqueTournamentId("IR1")).toBe(915);
    expect(getSportsApiUniqueTournamentId("SA1")).toBe(955);
  });

  it("resolves Saudi Pro League events to SA1", () => {
    expect(
      getLeagueCodeFromSportsApi({
        uniqueTournament: { id: 955, name: "Saudi Pro League" },
      }),
    ).toBe("SA1");
  });
});
