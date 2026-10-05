import { getLeagueCodeFromSportsApi } from "../competitionMapping";
import { getCanonicalTeamSync } from "../teams";
import type {
  CanonicalMatch,
  CanonicalIncident,
  CanonicalStatus,
  CanonicalScore,
  CanonicalIncidentType,
} from "../types";

function normalizeStatus(status?: { code?: number; type?: string; description?: string }): CanonicalStatus {
  if (!status) return "SCHEDULED";

  const type = status.type?.toLowerCase();
  const desc = status.description?.toUpperCase();
  const code = status.code;

  if (type === "finished" || desc === "ENDED" || desc === "FT" || desc === "AET" || desc === "AFTER ET" || desc === "AWARDED" || desc === "WO" || code === 100) return "FINISHED";
  if (type === "inprogress" || desc === "INPROGRESS" || desc === "1ST HALF" || desc === "2ND HALF" || desc === "HALFTIME" || code === 6 || code === 7 || code === 31) return "LIVE";
  if (type === "postponed" || desc === "POSTPONED" || code === 60) return "POSTPONED";
  if (type === "canceled" || desc === "CANCELED" || desc === "CANCELLED" || code === 70) return "VOID";
  if (type === "suspended" || desc === "SUSPENDED" || code === 50) return "SUSPENDED";
  if (type === "notstarted" || code === 0) return "SCHEDULED";

  return "SCHEDULED";
}

function extractGoals(scoreObj: any): number | null {
  if (!scoreObj) return null;
  if (typeof scoreObj.display === "number") return scoreObj.display;
  if (typeof scoreObj.current === "number") return scoreObj.current;
  if (typeof scoreObj.normaltime === "number") return scoreObj.normaltime;
  return null;
}

function isPenaltyShootoutIncident(rawIncident: any): boolean {
  const text = [
    rawIncident?.incidentType,
    rawIncident?.incidentClass,
    rawIncident?.description,
    rawIncident?.text,
    rawIncident?.period,
  ].filter(Boolean).join(" ").toLowerCase();
  return Boolean(
    rawIncident?.isPenaltyShootout ||
    rawIncident?.penaltyShootout ||
    text.includes("penalty shootout") ||
    text.includes("penaltyshootout") ||
    text.includes("shootout") ||
    (Number(rawIncident?.time) === 0 && text.includes("penalty")),
  );
}

function resolveTeamLogo(team: any): string | null {
  if (!team) return null;
  const teamId = team.id || team.eventId;
  // 1. All teams with an ID: Cached secure proxy (30 days cache)
  if (teamId) {
    return `/api/team-image/${teamId}`;
  }

  // 2. Fallback to country flag if no team ID is present
  const name = String(team.name || "").toLowerCase();
  const alpha2 = team.country?.alpha2?.toLowerCase();

  if (name.includes("england")) return "https://flagcdn.com/w160/gb-eng.png";
  if (name.includes("scotland")) return "https://flagcdn.com/w160/gb-sct.png";
  if (name.includes("wales")) return "https://flagcdn.com/w160/gb-wls.png";
  if (name.includes("northern ireland")) return "https://flagcdn.com/w160/gb-nir.png";
  if (alpha2 && alpha2.length === 2) return `https://flagcdn.com/w160/${alpha2}.png`;

  return null;
}

export function normalizeSportsApiMatch(rawInput: any): CanonicalMatch | null {
  if (!rawInput) return null;
  const rawEvent = rawInput.event || rawInput;

  const rawTournament =
    rawEvent.tournament ||
    (rawEvent.uniqueTournament ? { uniqueTournament: rawEvent.uniqueTournament } : null);

  const leagueCode = getLeagueCodeFromSportsApi(rawTournament);

  // If we can't map the league, we drop it (Competition filtering is strictly preserved)
  if (!leagueCode) return null;

  const rawId = rawEvent.id || rawEvent.eventId;
  if (!rawId) return null;

  const rawStart = rawEvent.startTimestamp || rawEvent.startDate || rawEvent.startTime;
  let kickoff: Date;
  if (typeof rawStart === "number") {
    kickoff = new Date(rawStart > 1e11 ? rawStart : rawStart * 1000);
  } else if (rawStart) {
    kickoff = new Date(rawStart);
  } else {
    kickoff = new Date();
  }

  const matchday = Number(rawEvent.roundInfo?.round ?? 0);

  // Derive season Start Year. e.g. "26/27" -> 2026, or "2026" -> 2026.
  let seasonYear = kickoff.getUTCFullYear();
  if (rawEvent.season?.year) {
    const parsed = parseInt(String(rawEvent.season.year).split("/")[0], 10);
    if (parsed > 1900) {
      seasonYear = parsed;
    } else if (parsed > 0 && parsed < 100) {
      seasonYear = 2000 + parsed;
    }
  }

  const homeScore: CanonicalScore = {
    current: rawEvent.homeScore?.current ?? null,
    display: rawEvent.homeScore?.display ?? null,
    period1: rawEvent.homeScore?.period1 ?? null,
    period2: rawEvent.homeScore?.period2 ?? null,
    normaltime: rawEvent.homeScore?.normaltime ?? null,
    overtime: rawEvent.homeScore?.overtime ?? null,
    penalties: rawEvent.homeScore?.penalties ?? null,
  };

  const awayScore: CanonicalScore = {
    current: rawEvent.awayScore?.current ?? null,
    display: rawEvent.awayScore?.display ?? null,
    period1: rawEvent.awayScore?.period1 ?? null,
    period2: rawEvent.awayScore?.period2 ?? null,
    normaltime: rawEvent.awayScore?.normaltime ?? null,
    overtime: rawEvent.awayScore?.overtime ?? null,
    penalties: rawEvent.awayScore?.penalties ?? null,
  };

  const homeCanonical = getCanonicalTeamSync({
    provider: "sportsapi",
    providerTeamId: rawEvent.homeTeam?.id || 0,
    name: rawEvent.homeTeam?.name || "Unknown",
    country: rawEvent.homeTeam?.country,
    isNational: Boolean(rawEvent.homeTeam?.national),
  });

  const awayCanonical = getCanonicalTeamSync({
    provider: "sportsapi",
    providerTeamId: rawEvent.awayTeam?.id || 0,
    name: rawEvent.awayTeam?.name || "Unknown",
    country: rawEvent.awayTeam?.country,
    isNational: Boolean(rawEvent.awayTeam?.national),
  });

  const canonicalStatus = normalizeStatus(rawEvent.status);
  let canonicalElapsed: number | null = null;
  if (canonicalStatus === "FINISHED") {
    canonicalElapsed = 90;
  } else if (canonicalStatus === "LIVE") {
    const desc = String(rawEvent.status?.description || "").toLowerCase();
    const isHalftime = (desc.includes("half") && !desc.includes("1st") && !desc.includes("2nd")) || rawEvent.status?.code === 31;
    if (isHalftime) {
      canonicalElapsed = 45;
    } else {
      const isSecondHalf = desc.includes("2nd") || rawEvent.lastPeriod === "period2" || rawEvent.status?.code === 7;
      const baseMinutes = isSecondHalf ? 45 : 0;
      const timestamp = rawEvent.time?.currentPeriodStartTimestamp || rawEvent.statusTime?.timestamp;
      if (timestamp) {
        const calc = baseMinutes + Math.floor((Date.now() / 1000 - timestamp) / 60);
        canonicalElapsed = Math.min(130, Math.max(1, calc));
      } else if (isSecondHalf) {
        canonicalElapsed = 46;
      } else {
        canonicalElapsed = 1;
      }
    }
  }

  const homeLogo = homeCanonical.logoUrl || resolveTeamLogo(rawEvent.homeTeam);
  const awayLogo = awayCanonical.logoUrl || resolveTeamLogo(rawEvent.awayTeam);

  return {
    provider: "sportsapi",
    providerMatchId: String(rawId),
    sportsApiId: Number(rawId),
    leagueCode,
    matchday,
    seasonStartYear: seasonYear,
    roundId: `${leagueCode}:${seasonYear}:${matchday}`,
    homeTeamProviderId: String(rawEvent.homeTeam?.id || "0"),
    awayTeamProviderId: String(rawEvent.awayTeam?.id || "0"),
    homeTeam: {
      id: Number(rawEvent.homeTeam?.id || 0),
      name: homeCanonical.name,
      faName: homeCanonical.faName,
      logoUrl: homeLogo,
      logo: homeLogo,
      shortName: rawEvent.homeTeam?.shortName,
      code: rawEvent.homeTeam?.nameCode,
    },
    awayTeam: {
      id: Number(rawEvent.awayTeam?.id || 0),
      name: awayCanonical.name,
      faName: awayCanonical.faName,
      logoUrl: awayLogo,
      logo: awayLogo,
      shortName: rawEvent.awayTeam?.shortName,
      code: rawEvent.awayTeam?.nameCode,
    },
    kickoffAt: kickoff,
    status: canonicalStatus,
    elapsed: canonicalElapsed,
    homeGoals: extractGoals(rawEvent.homeScore),
    awayGoals: extractGoals(rawEvent.awayScore),
    homeScore,
    awayScore,
    venue: rawEvent.venue
      ? {
          id: rawEvent.venue.id ?? null,
          name: rawEvent.venue.name ?? null,
          city: rawEvent.venue.city?.name ?? rawEvent.venue.city ?? null,
        }
      : null,
    availability: {
      score: { available: true, source: "rest" },
      incidents: { available: false },
      stats: { available: false },
      odds: { available: false },
      lineups: { available: false },
    },
    rawApiResponse: rawEvent,
    updatedAt: new Date(),
    createdAt: new Date(),
    lastChangeTimestamp: rawEvent.changes?.changeTimestamp ?? null,
  };
}

export function normalizeSportsApiIncident(rawIncident: any): CanonicalIncident | null {
  if (!rawIncident || !rawIncident.id) return null;

  let type: CanonicalIncidentType = "other";
  const rawType = String(rawIncident.incidentType).toLowerCase();

  if (rawType.includes("goal")) type = "goal";
  else if (rawType.includes("card")) type = "card";
  else if (rawType.includes("sub")) type = "substitution";
  else if (rawType.includes("var")) type = "var";
  else if (rawType.includes("period")) type = "period";
  else if (rawType.includes("injury")) type = "injury_time";

  let cardType: "yellow" | "red" | "yellow_red" | undefined;
  if (type === "card") {
    if (rawIncident.incidentClass === "yellow") cardType = "yellow";
    else if (rawIncident.incidentClass === "red") cardType = "red";
    else if (rawIncident.incidentClass === "yellowRed") cardType = "yellow_red";
  }

  return {
    id: String(rawIncident.id),
    type,
    time: rawIncident.time ?? 0,
    addedTime: rawIncident.addedTime ?? null,
    period: rawIncident.timeSeconds ? "live" : undefined,
    teamId: rawIncident.isHome ? rawIncident.teamId : undefined,
    playerName: rawIncident.player?.name,
    playerInName: rawIncident.playerIn?.name,
    playerOutName: rawIncident.playerOut?.name,
    cardType,
    score:
      rawIncident.homeScore !== undefined && rawIncident.awayScore !== undefined
        ? { home: rawIncident.homeScore, away: rawIncident.awayScore }
        : undefined,
    detail: rawIncident.incidentClass || rawIncident.description,
    isPenaltyShootout: isPenaltyShootoutIncident(rawIncident),
  };
}
