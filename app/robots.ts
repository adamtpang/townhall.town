import type { MetadataRoute } from "next";
import { SITE } from "../lib/site";

// Allow every crawler and agent, including AI user agents. /api/ is not crawlable content.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
