import type { MetadataRoute } from "next";
import { CONTENT_UPDATED, PAGES, SITE } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: p === "/" ? `${SITE.url}/` : `${SITE.url}${p}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: p === "/" ? "daily" : "monthly",
    priority: p === "/" ? 1 : 0.5,
  }));
}
