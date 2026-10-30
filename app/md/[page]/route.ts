import { notFoundMarkdown, pageMarkdown } from "../../../lib/content";
import { PAGES, type PagePath } from "../../../lib/site";

// Markdown twins of the HTML pages. Reached via middleware rewrite when Accept prefers text/markdown.
const SLUGS: Record<string, PagePath> = Object.fromEntries(PAGES.map((p) => [p === "/" ? "index" : p.slice(1), p]));

const headers = (extra: Record<string, string> = {}) => ({
  "Content-Type": "text/markdown; charset=utf-8",
  Vary: "Accept",
  ...extra,
});

export async function GET(req: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const path = SLUGS[page];
  if (path) {
    return new Response(pageMarkdown(path), {
      headers: headers({ "Cache-Control": "public, max-age=300", Link: `<https://townhall.town${path === "/" ? "/" : path}>; rel="canonical"` }),
    });
  }
  const original = new URL(req.url).searchParams.get("path") || `/md/${page}`;
  return new Response(notFoundMarkdown(original), { status: 404, headers: headers({ "Cache-Control": "no-store" }) });
}
