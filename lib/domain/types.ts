export type ClubState = "FORMING" | "ACTIVE";
export type ClubRole = "OWNER" | "MEMBER";
export type ClubVisibility = "PUBLIC" | "PRIVATE";
export type ClubDiscoveryMode = "INVITE_ONLY" | "RECRUITING";
export type RoundStatus = "UPCOMING" | "LIVE" | "PENDING" | "FINAL";

export type SeasonRecord = { id: string; label: string; startsAt: Date; endsAt: Date };
export type LeagueSeasonRecord = { id: string; leagueCode: string; seasonId: string; teamCount?: number; expectedFixturesPerRound?: number };
export type RoundRecord = {
  id: string;
  leagueSeasonId: string;
  leagueCode: string;
  seasonId: string;
  number: number;
  name: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  status: RoundStatus;
  completedFixtures: number;
  eligibleFixtures: number;
  expectedFixtures: number | null;
  updatedAt: Date;
};

export type ClubRecord = {
  _id?: unknown;
  name: string;
  imageUrl: string | null;
  state: ClubState;
  discoveryMode: ClubDiscoveryMode;
  visibility: ClubVisibility;
  ownerId: string;
  leaderboardCompetitionCodes?: string[];
  activatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClubMembershipRecord = {
  _id?: unknown;
  clubId: string;
  userId: string;
  role: ClubRole;
  joinedAt: Date;
  leftAt: Date | null;
};

export type PredictionLockSnapshot = {
  _id?: unknown;
  predictionId: string;
  userId: string;
  matchId: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  clubIdAtLock: string | null;
  membershipIdAtLock: string | null;
  lockedAt: Date;
};

export type CanonicalPredictionScore = {
  _id?: unknown;
  predictionId: string;
  fixtureId: string;
  matchId: string;
  userId: string;
  leagueCode: string;
  seasonId: string;
  seasonStartYear: number;
  roundId: string | null;
  matchday: number;
  points: number;
  category: string;
  exactScore: boolean;
  correctOutcome: boolean;
  actualHomeGoals: number;
  actualAwayGoals: number;
  clubIdAtLock: string | null;
  scoringVersion: string;
  calculatedAt: Date;
};
