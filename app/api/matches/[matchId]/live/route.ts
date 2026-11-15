import { GET as getMatchIntelligence } from "../intelligence/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Legacy live endpoint, now cache-only. Streaming SSE previously allocated a
 * long-lived serverless connection per browser, and could cause upstream
 * provider subscriptions. All callers must use bounded conditional polling.
 * Even requests with ?stream=true get JSON, never an SSE connection.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ matchId: string }> },
) {
  const response = await getMatchIntelligence(request, context);
  if (response.status === 304 || !response.ok) return response;
  const data = await response.json();
  const live = data.live;
  return Response.json({
    matchId: data.match.providerMatchId,
    score: live?.score ?? {
      home: data.match.homeGoals ?? null,
      away: data.match.awayGoals ?? null,
      status: data.match.status || "SCHEDULED",
      elapsed: null,
    },
    incidents: live?.incidents ?? [],
    stats: live?.stats ?? [],
    lineups: live?.lineups ?? null,
    lastUpdateAt: live?.updatedAt ? new Date(live.updatedAt).getTime() : null,
  }, {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: response.headers.get("etag") ?? "",
      "X-Realtime-Transport": "conditional-polling",
    },
  });
}
