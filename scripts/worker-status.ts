import { closeMongo } from "../lib/db/mongo";
import { workerStatus } from "../lib/worker/localWorker";

workerStatus()
  .then((status) => console.log(JSON.stringify(status, null, 2)))
  .catch((error) => {
    console.error("lowblock_worker_status_failed", error);
    process.exitCode = 1;
  })
  .finally(() => closeMongo().catch(() => undefined));
