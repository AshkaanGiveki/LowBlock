import { NextResponse } from "next/server";
import { getMatchMonitorService } from "@/lib/football/sportsapi/matchMonitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  if (!matchId) {
    return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
  }

  const monitor = getMatchMonitorService();
  const acceptHeader = request.headers.get("accept") || "";
  const url = new URL(request.url);
  const wantsStream =
    acceptHeader.includes("text/event-stream") ||
    url.searchParams.get("stream") === "true";

  if (!wantsStream) {
    // Return instant snapshot JSON
    const snapshot = monitor.getSnapshot(matchId);
    return NextResponse.json(snapshot);
  }

  // Server-Sent Events (SSE) Stream
  const encoder = new TextEncoder();
  let cleanupSubscription: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial snapshot
      const initial = monitor.getSnapshot(matchId);
      controller.enqueue(
        encoder.encode(`event: snapshot\ndata: ${JSON.stringify(initial)}\n\n`),
      );

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
