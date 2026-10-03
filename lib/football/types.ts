/**
 * Canonical Football Data Types & Provider Abstraction
 *
 * Designed to provide a provider-neutral interface between data providers
 * (e.g., API-Sports, SportsAPI Pro) and the LowBlock application layer.
 */

export type ProviderName = "football-api" | "sportsapi";

export type CanonicalStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "VOID";

export type CanonicalTeam = {
  id: number;
  name: string;
  faName?: string;
  logoUrl: string | null;
  logo?: string | null;
  shortName?: string;
  code?: string;
};

export type CanonicalScore = {
  current: number | null;
  display?: number | null;
  period1?: number | null;
  period2?: number | null;
  normaltime?: number | null;
  overtime?: number | null;
  penalties?: number | null;
};

export type CanonicalIncidentType =
  | "goal"
  | "card"
  | "substitution"
  | "var"
  | "period"
  | "injury_time"
  | "other";

export type CanonicalIncident = {
  id: string;
  type: CanonicalIncidentType;
  time: number;
  addedTime?: number | null;
  period?: string;
  teamId?: number;
  playerName?: string;
  playerInName?: string;
  playerOutName?: string;
  cardType?: "yellow" | "red" | "yellow_red";
  score?: { home: number; away: number };
  detail?: string;
};

export type TeamStatPair = {
  home: number;
  away: number;
};

export type CanonicalStatistics = {
  possession?: TeamStatPair;
  shots?: TeamStatPair;
  shotsOnTarget?: TeamStatPair;
  corners?: TeamStatPair;
  fouls?: TeamStatPair;
  yellowCards?: TeamStatPair;
  redCards?: TeamStatPair;
  passes?: TeamStatPair;
  passAccuracy?: TeamStatPair;
  xg?: TeamStatPair;
  saves?: TeamStatPair;
  offsides?: TeamStatPair;
};

export type CanonicalOdds = {
  provider: string;
  updatedAt?: Date | string;
  matchWinner?: { home: number; draw: number; away: number };
  overUnder25?: { over: number; under: number };
  btts?: { yes: number; no: number };
  rawMarkets?: unknown;
};

export type LineupPlayer = {
  id: number;
  name: string;
  number?: number;
  position?: string;
};

export type CanonicalLineups = {
  home: {
    formation?: string;
    startingXI: LineupPlayer[];
    substitutes: LineupPlayer[];
  };
  away: {
    formation?: string;
    startingXI: LineupPlayer[];
    substitutes: LineupPlayer[];
  };
};

export type DataCategoryAvailability = {
  available: boolean;
  source?: string;
  reason?: string;
  lastUpdateAt?: Date | string;
};

export type DataAvailability = {
  score: DataCategoryAvailability;
  incidents: DataCategoryAvailability;
  stats: DataCategoryAvailability;
  odds: DataCategoryAvailability;
  lineups: DataCategoryAvailability;
};

export type CanonicalMatch = {
  provider: ProviderName;
  providerMatchId: string;
  sportsApiId?: number;
  apiSportsId?: number;
  leagueCode: string;
  matchday: number;
  seasonStartYear: number;
  roundId: string;
  homeTeamProviderId: string;
  awayTeamProviderId: string;
  homeTeam: CanonicalTeam;
  awayTeam: CanonicalTeam;
  kickoffAt: Date;
  status: CanonicalStatus;
  elapsed: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeScore?: CanonicalScore;
  awayScore?: CanonicalScore;
  venue?: { id: number | null; name: string | null; city: string | null } | null;
  availability: DataAvailability;
  incidents?: CanonicalIncident[];
  statistics?: CanonicalStatistics | null;
  odds?: CanonicalOdds | null;
  lineups?: CanonicalLineups | null;
  lastFrameAt?: Date | string | null;
  lastChangeTimestamp?: number | null;
  rawApiResponse?: unknown;
  updatedAt?: Date;
  createdAt?: Date;
};

export type SyncOptions = {
  mode?: "current" | "season";
  season?: number;
};

export type SyncScoreEngineResult = {
  scores: number;
  leaderboards: number;
  matches?: number;
  roundWinners?: number;
  awards?: unknown;
};

export type SyncResult = {
  total: number;
  listRequests: number;
  detailRequests: number;
  rounds: number;
  insights?: unknown;
  scoreEngine: SyncScoreEngineResult;
  leaderboardEngine?: unknown;
};

export type SyncDateResult = {
  total: number;
  listRequests: number;
  scoreEngine: SyncScoreEngineResult;
  leaderboardEngine?: unknown;
};

export type ProviderRealtimeStatus = {
  connected: boolean;
  activeSubscriptions: string[];
  lastPingAt?: Date;
  lastFrameAt?: Date;
  reconnectAttempts: number;
};

/**
 * Standard abstraction for football data providers.
 */
export interface FootballDataProvider {
  readonly name: ProviderName;
  getDailyMatches(dates: string[]): Promise<CanonicalMatch[]>;
  sync(options?: SyncOptions): Promise<SyncResult>;
  syncDate(dateKey: string): Promise<SyncDateResult>;
  getMatchDetails?(matchId: string): Promise<CanonicalMatch | null>;
  startRealtime?(): void;
  stopRealtime?(): void;
  getRealtimeStatus?(): ProviderRealtimeStatus;
}
