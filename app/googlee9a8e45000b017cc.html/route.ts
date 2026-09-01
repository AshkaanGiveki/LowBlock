export const dynamic = "force-static";

export function GET() {
  return new Response("google-site-verification: googlee9a8e45000b017cc.html", {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
