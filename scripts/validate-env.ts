import { env, validateProductionEnv } from "../lib/env";
validateProductionEnv();
console.log(
  `Environment valid for ${process.env.NODE_ENV ?? "development"} (${env.NEXT_PUBLIC_APP_URL})`,
);
