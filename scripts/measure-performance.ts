void (async () => {
  const baseUrl = (
    process.env.PERFORMANCE_BASE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const targets = [
    "/",
    "/leagues",
    "/how-scoring-works",
    "/matches",
    "/leaderboard",
    "/lowblock",
  ];
  const measurements = [];
  for (const path of targets) {
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
      const body = await response.arrayBuffer();
      measurements.push({
        path,
        status: response.status,
        ttfbMs: Math.round((performance.now() - started) * 100) / 100,
        responseBytes: body.byteLength,
        cacheControl: response.headers.get("cache-control"),
        serverTiming: response.headers.get("server-timing"),
      });
    } catch (error) {
      measurements.push({
        path,
        error: error instanceof Error ? error.message : String(error),
        ttfbMs: Math.round((performance.now() - started) * 100) / 100,
      });
    }
  }
  console.log(
    JSON.stringify(
      { baseUrl, measuredAt: new Date().toISOString(), measurements },
      null,
      2,
    ),
  );
})();
