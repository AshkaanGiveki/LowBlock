import { getDb, closeMongo } from "../lib/db/mongo";
import { settleH2HLeagues } from "../lib/domain/h2h";
settleH2HLeagues(await getDb()).then(console.log).catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeMongo().catch(() => undefined));
