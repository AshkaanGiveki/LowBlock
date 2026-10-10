import { NextResponse } from "next/server";
import { getMatchMonitorService } from "@/lib/football/sportsapi/matchMonitor";
import { ensureSportsApiBackgroundService } from "@/lib/football/sportsapi/backgroundService";
import { isSportsApiRealtimeEnabled } from "@/lib/football/sportsapi/ws";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Hobby permits function durations up to 60 seconds. The browser's
// EventSource automatically reconnects after this bounded stream closes.
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  if (!matchId) {
    return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
  }

  ensureSportsApiBackgroundService();
  const monitor = getMatchMonitorService();
  const acceptHeader = request.headers.get("accept") || "";
  const url = new URL(request.url);
  const wantsStream =
    acceptHeader.includes("text/event-stream") ||
    url.searchParams.get("stream") === "true";

  // Emergency protection: do not open long-lived SSE streams while realtime
  // WebSocket fan-out is disabled in Vercel. Return the persisted snapshot so
  // the match page remains usable without adding connection pressure.
  if (wantsStream && !isSportsApiRealtimeEnabled()) {
    const snapshot = await monitor.loadSnapshotFromDb(matchId);
    return NextResponse.json(snapshot, {
      headers: { "X-Realtime-Disabled": "true" },
    });
  }

  if (!wantsStream) {
    // Return instant snapshot JSON populated from DB / in-memory cache
    const snapshot = await monitor.loadSnapshotFromDb(matchId);
    return NextResponse.json(snapshot);
  }

  // Send the in-process WebSocket snapshot immediately. Hydrate the persisted
  // details asynchronously so opening the drawer never waits on Mongo.
  const initial = monitor.getSnapshot(matchId);

  // Server-Sent Events (SSE) Stream
  const encoder = new TextEncoder();
  let cleanupSubscription: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial snapshot
      controller.enqueue(
        encoder.encode(`event: snapshot\ndata: ${JSON.stringify(initial)}\n\n`),
      );

      monitor.loadSnapshotFromDb(matchId).then((snapshot) => {
        try {
          controller.enqueue(
            encoder.encode(`event: update\ndata: ${JSON.stringify(snapshot)}\n\n`),
          );
        } catch {}
      }).catch(() => undefined);

      // Subscribe to real-time events
      cleanupSubscription = monitor.subscribeToMatch(matchId, (snapshot) => {
        try {
          controller.enqueue(
            encoder.encode(`event: update\ndata: ${JSON.stringify(snapshot)}\n\n`),
          );
        } catch (err) {
          console.error("[SSE] Failed to enqueue update:", err);
        }
      });

      // Keepalive ping every 15s to prevent cloud proxy disconnects
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        if (cleanupSubscription) {
          cleanupSubscription();
          cleanupSubscription = null;
        }
      });
    },
    cancel() {
      if (cleanupSubscription) {
        cleanupSubscription();
        cleanupSubscription = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
