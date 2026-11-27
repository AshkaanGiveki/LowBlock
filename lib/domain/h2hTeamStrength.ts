/**
 * Team-strength calibration for non-wagering Super League fixture selection.
 *
 * Ratings are evidence estimates, NOT odds or win probabilities. Each team
 * receives a competition-adjusted prior; recent results against rated
 * opponents update it using a damped Elo-like procedure. Few or no results
 * mean a lower confidence and a stronger pull toward the prior.
 */
export const H2H_STRENGTH_VERSION = "h2h-calibrated-v2";
const BASELINE: Record<string, number> = {
  GB1: 71, ES1: 70, IT1: 69, L1: 68, FR1: 67,
  UCL: 68, UEL: 64, UECL: 60,
  GB2: 57, DE2: 55, ES2: 55, IT2: 54, FR2: 54,
  TR1: 56, SA1: 56, IR1: 52, ACLE: 59,
  GB_FA: 49, ES_COPA: 49, FR_CUP: 49, DE_CUP: 49,
  IT_CUP: 49, TR_CUP: 49, GB_CARABAO: 49,
  WC_U17: 44,
  NATIONS: 60, AFCONQ: 57, FRIENDLY: 56, INTL_OTHER: 56,
};
export function h2hCompetitionBaseline(code: string): number {
  return BASELINE[code] ?? 51;
}
const cap = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export type TeamRatingInput = {
  centralTeamId?: string;
  h2hRating?: number | null;
  h2hRatingVersion?: string;
  h2hLegacyRating?: number | null;
  isNational?: boolean;
  currentLeagueCodes?: string[];
  names?: { en?: string };
};
export type ResultMatch = {
  leagueCode?: string;
  kickoffAt?: Date | string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  duplicateOf?: string | null;
  homeTeam?: { centralTeamId?: string };
  awayTeam?: { centralTeamId?: string };
};
export type CalibratedRating = {
  centralTeamId: string;
  rating: number;
  confidence: number;
  matchesUsed: number;
  prior: number;
  legacyRating: number | null;
};

export function calibrateH2HTeamRatings(
  teams: TeamRatingInput[],
  fixtures: ResultMatch[],
  now = new Date(),
): CalibratedRating[] {
  const leagueCodes = new Map<string, Set<string>>();
  const teamById = new Map<string, TeamRatingInput>();
  for (const team of teams) {
    const id = String(team.centralTeamId ?? "");
    if (!id) continue;
    teamById.set(id, team);
    leagueCodes.set(id, new Set(team.currentLeagueCodes ?? []));
  }
  const cutoff = now.getTime() - 365 * 86_400_000;
  const valid = fixtures.filter((match) => {
    const time = new Date(match.kickoffAt ?? "").getTime();
    return !match.duplicateOf && match.status === "FINISHED" &&
      Number.isFinite(time) && time >= cutoff && time <= now.getTime() &&
      Number.isFinite(match.homeGoals) && Number.isFinite(match.awayGoals) &&
      Number(match.homeGoals) >= 0 && Number(match.awayGoals) >= 0 &&
      match.homeTeam?.centralTeamId && match.awayTeam?.centralTeamId &&
      match.homeTeam.centralTeamId !== match.awayTeam.centralTeamId &&
      teamById.has(String(match.homeTeam.centralTeamId)) &&
      teamById.has(String(match.awayTeam.centralTeamId));
  }).sort((a, b) => new Date(a.kickoffAt!).getTime() - new Date(b.kickoffAt!).getTime());
  // Competition history provides an evidence-based prior even for teams
  // missing from the old manually curated 433-team rating snapshot.
  for (const match of fixtures) {
    const code = String(match.leagueCode ?? "");
    for (const id of [match.homeTeam?.centralTeamId, match.awayTeam?.centralTeamId]) {
      const known = leagueCodes.get(String(id ?? ""));
      if (known && code) known.add(code);
    }
  }
  const prior = new Map<string, number>();
  const current = new Map<string, number>();
  const samples = new Map<string, number>();
  const legacy = new Map<string, number | null>();
  for (const [id, team] of teamById) {
    const codes = [...(leagueCodes.get(id) ?? [])];
    const isYouth = codes.includes("WC_U17") || /\bU[ -]?1[579]\b/i.test(team.names?.en ?? "");
    const basis = isYouth ? 44 : codes.length
      ? Math.max(...codes.map(h2hCompetitionBaseline))
      : team.isNational ? 56 : 51;
    const original = Number.isFinite(team.h2hLegacyRating)
      ? Number(team.h2hLegacyRating)
      : team.h2hRatingVersion !== H2H_STRENGTH_VERSION &&
        Number.isFinite(team.h2hRating) ? Number(team.h2hRating) : null;
    // The old curation remains a weak prior, not an absolute ranking.
    const seed = original === null ? 0 : cap((original - 58) * 0.24, -4.5, 9.5);
    const value = cap(basis + seed, 35, 92);
    prior.set(id, value);
    current.set(id, value);
    legacy.set(id, original);
    samples.set(id, 0);
  }
  for (const match of valid) {
    const homeId = String(match.homeTeam!.centralTeamId);
    const awayId = String(match.awayTeam!.centralTeamId);
    const home = current.get(homeId)!;
    const away = current.get(awayId)!;
    const hg = Number(match.homeGoals), ag = Number(match.awayGoals);
    const actual = hg === ag ? 0.5 : hg > ag ? 1 : 0;
    const expected = 1 / (1 + Math.pow(10, (away - home) / 22));
    const daysOld = Math.max(0, (now.getTime() - new Date(match.kickoffAt!).getTime()) / 86_400_000);
    const recency = 0.55 + 0.45 * Math.exp(-daysOld / 140);
    const margin = 1 + Math.min(3, Math.abs(hg - ag)) * 0.12;
    const strength = match.leagueCode === "GB_FA" ||
      match.leagueCode === "FR_CUP" || match.leagueCode === "ES_COPA" ? 0.8 : 1;
    const delta = 5.2 * (actual - expected) * recency * margin * strength;
    current.set(homeId, cap(home + delta, 30, 95));
    current.set(awayId, cap(away - delta, 30, 95));
    samples.set(homeId, samples.get(homeId)! + 1);
    samples.set(awayId, samples.get(awayId)! + 1);
  }
  return [...teamById.keys()].map((id) => {
    const n = samples.get(id)!;
    const baseline = prior.get(id)!;
    const empiricalWeight = n / (n + 4);
    const final = cap(baseline + (current.get(id)! - baseline) * empiricalWeight, 35, 95);
    const confidence = cap(0.20 + 0.60 * (1 - Math.exp(-n / 7)) +
      (legacy.get(id) !== null ? 0.15 : 0), 0.2, 0.95);
    return {
      centralTeamId: id,
      rating: Math.round(final * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      matchesUsed: n,
      prior: Math.round(baseline * 10) / 10,
      legacyRating: legacy.get(id)!,
    };
  });
}
