type ClientMetric = {
  name: string;
  value: number;
  path: string;
  navigationType?: string;
  metadata?: Record<string, unknown>;
};

function send(metric: ClientMetric) {
  const body = JSON.stringify({ ...metric, at: new Date().toISOString() });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/telemetry",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }
  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function startClientMetrics() {
  if (
    typeof window === "undefined" ||
    typeof PerformanceObserver === "undefined"
  )
    return;
  const path = () => window.location.pathname;
  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (navigation)
    send({
      name: "navigation",
      value: Math.round(navigation.responseStart),
      path: path(),
      navigationType: navigation.type,
      metadata: {
        ttfb: navigation.responseStart,
        domInteractive: navigation.domInteractive,
        loadEventEnd: navigation.loadEventEnd,
      },
    });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        send({
          name: "lcp",
          value: Math.round(
            (entry as PerformanceEntry & { startTime: number }).startTime,
          ),
          path: path(),
        });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    /* unsupported */
  }
  try {
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >)
        if (!entry.hadRecentInput) cls += entry.value;
      send({ name: "cls", value: Number(cls.toFixed(4)), path: path() });
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    /* unsupported */
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { duration: number; name: string }
      >)
        send({
          name: "long-task",
          value: Math.round(entry.duration),
          path: path(),
          metadata: { task: entry.name },
        });
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* unsupported */
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & {
          duration: number;
          interactionId?: number;
          processingStart: number;
          startTime: number;
        }
      >)
        if (entry.interactionId)
          send({
            name: "inp",
            value: Math.round(
              entry.processingStart + entry.duration - entry.startTime,
            ),
            path: path(),
            metadata: { interactionId: entry.interactionId },
          });
    }).observe({
      type: "event",
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit & { durationThreshold: number });
  } catch {
    /* unsupported */
  }
  window.addEventListener(
    "load",
    () => {
      const current = performance.getEntriesByType("navigation")[0] as
        PerformanceNavigationTiming | undefined;
      if (current)
        send({
          name: "load",
          value: Math.round(current.loadEventEnd),
          path: path(),
        });
    },
    { once: true },
  );
}
