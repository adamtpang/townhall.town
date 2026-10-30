// Content negotiation for Markdown (acceptmarkdown.com). Pure functions so they can be unit tested.
import { PAGES, type PagePath } from "./site";

const MD_TYPES = ["text/markdown", "text/x-markdown"];

/** q-value for a media type in an Accept header, honoring exact matches only (wildcards do not opt in to Markdown). */
function qFor(accept: string, types: string[]): number {
  let best = -1;
  for (const part of accept.toLowerCase().split(",")) {
    const [type, ...params] = part.trim().split(";").map((s) => s.trim());
    if (!types.includes(type)) continue;
    const qp = params.find((p) => p.startsWith("q="));
    const q = qp ? Number(qp.slice(2)) : 1;
    if (Number.isFinite(q) && q > best) best = q;
  }
  return best;
}

/** True when the client explicitly asks for Markdown at least as strongly as HTML. */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  const md = qFor(accept, MD_TYPES);
  if (md <= 0) return false;
  return md >= qFor(accept, ["text/html", "application/xhtml+xml"]);
}

export function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

export function knownPage(pathname: string): PagePath | null {
  const p = normalizePath(pathname);
  return (PAGES as readonly string[]).includes(p) ? (p as PagePath) : null;
}

/** Slug used by app/md/[page]/route.ts for a known page. */
export function mdSlug(page: PagePath): string {
  return page === "/" ? "index" : page.slice(1);
}

/** Internal rewrite target for a Markdown request to `pathname`. */
export function markdownRewrite(pathname: string): string {
  const page = knownPage(pathname);
  return page ? `/md/${mdSlug(page)}` : `/md/404?path=${encodeURIComponent(pathname)}`;
}

/** Merge Accept into an existing Vary header without dropping Next's RSC values. */
export function mergeVary(existing: string | null | undefined, add = "Accept"): string {
  const parts = (existing || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.includes("*")) return "*";
  if (!parts.some((p) => p.toLowerCase() === add.toLowerCase())) parts.push(add);
  return parts.join(", ");
}
