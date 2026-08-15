export type MatchStatus="SCHEDULED"|"LIVE"|"FINISHED"|"POSTPONED"|"CANCELLED"|"UNKNOWN";
export type NormalizedTeam={provider:"transfermarkt";providerTeamId:string;sourceName:string;faName:string;crestUrl?:string;profileUrl?:string};
export type NormalizedMatch={provider:"transfermarkt";providerMatchId:string;leagueCode:string;seasonStartYear:number;matchday:number;homeTeamProviderId:string;awayTeamProviderId:string;kickoffAt:Date;status:MatchStatus;homeGoals:number|null;awayGoals:number|null;sourceUrl:string};
