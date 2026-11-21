import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Proxies may preserve the incoming host in x-forwarded-host while replacing
  // Host with their upstream address. Prefer the original public host so the
  // admin subdomain consistently serves the admin console at `/`.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = (forwardedHost ?? request.headers.get("host")?.split(":")[0] ?? "").toLowerCase();
  if (host === "admin.lowblock.ir" && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
