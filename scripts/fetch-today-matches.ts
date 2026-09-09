import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined)
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const configuredTimezone = process.env.APP_TIMEZONE || "Asia/Tehran";
const timezone = (() => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: configuredTimezone }).format();
    return configuredTimezone;
  } catch {
    return "Asia/Tehran";
  }
})();
const apiKey = process.env.FOOTBALL_API_KEY;
const baseUrl =
  process.env.FOOTBALL_API_BASE_URL || "https://v3.football.api-sports.io";

type ApiResponse = {
  errors?: unknown;
  response?: unknown[];
  [key: string]: unknown;
};

const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

if (!apiKey) throw new Error("FOOTBALL_API_KEY is not configured");
const footballApiKey = apiKey;

const url = new URL(`${baseUrl}/fixtures`);
url.searchParams.set("date", date);
url.searchParams.set("timezone", timezone);

async function main() {
  const response = await fetch(url, {
    headers: { "x-apisports-key": footballApiKey },
    cache: "no-store",
  });
  const body = (await response.json()) as ApiResponse;

  if (
    !response.ok ||
    (body.errors && Object.keys(body.errors as object).length)
  ) {
    throw new Error(
      `FOOTBALL_API_${response.status}: ${JSON.stringify(body.errors)}`,
    );
  }

  mkdirSync("data", { recursive: true });
  writeFileSync(
    `data/todays-matches-${date}.json`,
    `${JSON.stringify(body, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      date,
      matches: body.response?.length ?? 0,
      file: `data/todays-matches-${date}.json`,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
