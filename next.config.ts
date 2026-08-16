import type { NextConfig } from "next";
const nextConfig: NextConfig = { images: { remotePatterns: [{ protocol: "https", hostname: "img.a.transfermarkt.technology" }, { protocol: "https", hostname: "tmssl.akamaized.net" }, { protocol: "https", hostname: "media.api-sports.io" }] }, poweredByHeader: false };
export default nextConfig;
