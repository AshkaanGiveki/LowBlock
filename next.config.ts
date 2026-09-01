import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "img.a.transfermarkt.technology" }, { protocol: "https", hostname: "tmssl.akamaized.net" }, { protocol: "https", hostname: "media.api-sports.io" }] },
  poweredByHeader: false,
  // Award artwork is intentionally not public. Include it in server bundles
  // so the authorized trophy/share routes can stream it in production.
  outputFileTracingIncludes: {
    "/*": ["./lib/server-assets/awards/**/*"],
  },
};
export default nextConfig;
