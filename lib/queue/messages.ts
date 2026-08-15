import { z } from "zod";
export const FootballJob=z.object({version:z.literal(1),type:z.enum(["SYNC_COMPETITION","SYNC_MATCHDAY","SCORE_MATCH","REBUILD_LEADERBOARD_SCOPE"]),jobId:z.string().min(1),competitionCode:z.string().optional(),seasonStartYear:z.number().optional(),matchday:z.number().optional(),matchId:z.string().optional(),createdAt:z.string()});
export type FootballJob= z.infer<typeof FootballJob>;
