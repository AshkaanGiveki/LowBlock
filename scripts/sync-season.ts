import { syncFootballApi } from "../lib/football/api-sports/sync";
syncFootballApi().catch(error=>{console.error(error instanceof Error?error.message:"sync failed");process.exit(1)});
