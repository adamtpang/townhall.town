import { NextResponse, type NextRequest } from "next/server";
import { markdownRewrite, mergeVary, prefersMarkdown } from "./lib/negotiate";

// Markdown negotiation: Accept: text/markdown on a page rewrites to app/md/[page]/route.ts
// (Markdown body, or a Markdown 404 for unknown paths). HTML responses get Vary: Accept appended.
export function middleware(req: NextRequest) {
  if (prefersMarkdown(req.headers.get("accept"))) {
    return NextResponse.rewrite(new URL(markdownRewrite(req.nextUrl.pathname), req.url));
  }
  const res = NextResponse.next();
  res.headers.set("Vary", mergeVary(res.headers.get("Vary")));
  return res;
}

export const config = {
  // Pages only: skip API routes, Next assets, the Markdown handlers, metadata images and any path with a file extension.
  matcher: ["/((?!api/|_next/|md/|opengraph-image|twitter-image|icon|apple-icon|favicon\\.ico|.*\\.[A-Za-z0-9]+$).*)"],
};
