import { describe, expect, it } from "vitest";
import {
  isSeniorFriendlyAllowedForMatch,
  isVerifiedSeniorFriendlyDate,
  unverifiedSeniorFriendlyRanges,
} from "@/lib/football/internationalWindows";
import { normalizeSportsApiMatch } from "@/lib/football/sportsapi/normalizer";

const event=(start:string,tournamentId:number)=>({
  id: 9010025,
  startTimestamp: Math.floor(new Date(start).getTime()/1000),
  homeTeam:{id:110,name:"France",national:true},
  awayTeam:{id:111,name:"Venezuela",national:true},
  tournament:{uniqueTournament:{id:tournamentId,name:tournamentId===851?"International Friendlies":"Unknown Competition"},
    category:{name:"World"}},
  status:{type:"notstarted"},
});

describe("senior international fixture verification", () => {
  it("rejects questionable Nov 27 2026 senior friendlies and unmapped internationals", () => {
    expect(isVerifiedSeniorFriendlyDate(new Date("2026-11-27T20:00:00Z"))).toBe(false);
    expect(normalizeSportsApiMatch(event("2026-11-27T20:00:00Z",851))).toBeNull();
    expect(normalizeSportsApiMatch(event("2026-11-27T20:00:00Z",99999))).toBeNull();
  });
  it("retains verified November window national fixtures and mapped official competitions", () => {
    expect(isVerifiedSeniorFriendlyDate("2026-11-14T20:00:00Z")).toBe(true);
    expect(isSeniorFriendlyAllowedForMatch("FRIENDLY","2026-11-14T20:00:00Z")).toBe(true);
    expect(normalizeSportsApiMatch(event("2026-11-14T20:00:00Z",851))?.leagueCode).toBe("FRIENDLY");
    expect(isSeniorFriendlyAllowedForMatch("NATIONS","2026-11-27T20:00:00Z")).toBe(true);
  });
  it("excludes only unsupported calendar segments when a page window crosses midnight", () => {
    const ranges=unverifiedSeniorFriendlyRanges(
      new Date("2026-11-17T17:00:00Z"),new Date("2026-11-18T12:00:00Z"));
    expect(ranges).toHaveLength(1);
    expect(ranges[0].start.toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(ranges[0].end.toISOString()).toBe("2026-11-18T12:00:00.000Z");
  });
});
