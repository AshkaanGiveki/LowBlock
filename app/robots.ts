import type { MetadataRoute } from "next";

const siteUrl = "https://lowblock.ir";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/app", "/login", "/signup", "/profile", "/predictions", "/platform-link", "/club/create", "/club/discover", "/club/*/settings", "/club/*/members", "/club/*/requests", "/club/*/join", "/invite/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
