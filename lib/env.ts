import { z } from "zod";
const schema=z.object({MONGODB_URI:z.string().optional(),SESSION_SECRET:z.string().min(16).optional(),CRON_SECRET:z.string().min(8).optional(),APP_TIMEZONE:z.string().default("Asia/Tehran"),TRANSFERMARKT_BASE_URL:z.string().url().default("https://www.transfermarkt.com")});
export const env=schema.parse({MONGODB_URI:process.env.MONGODB_URI,SESSION_SECRET:process.env.SESSION_SECRET,CRON_SECRET:process.env.CRON_SECRET,APP_TIMEZONE:process.env.APP_TIMEZONE,TRANSFERMARKT_BASE_URL:process.env.TRANSFERMARKT_BASE_URL});
