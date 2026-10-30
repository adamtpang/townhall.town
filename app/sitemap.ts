import type { MetadataRoute } from "next";
import { CONTENT_UPDATED, PAGES, SITE } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = PAGES.map((p) => ({
    url: p === "/" ? `${SITE.url}/` : `${SITE.url}${p}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: p === "/" ? "daily" : "monthly",
    priority: p === "/" ? 1 : 0.5,
  }));
  // Machine-readable developer resources. The versioning policy lives on /developers (#versioning).
  const files: MetadataRoute.Sitemap = ["/openapi.json", "/llms.txt"].map((p) => ({ url: `${SITE.url}${p}`, lastModified: CONTENT_UPDATED, changeFrequency: "monthly", priority: 0.3 }));
  return [...pages, ...files];
}
