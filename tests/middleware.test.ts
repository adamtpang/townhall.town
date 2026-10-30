import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "../middleware";

const req = (path: string, accept?: string) =>
  new NextRequest(new URL(path, "https://townhall.town"), { headers: accept ? { accept } : {} });

describe("middleware", () => {
  it("rewrites Markdown requests for pages to the Markdown handler", () => {
    const res = middleware(req("/", "text/markdown"));
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://townhall.town/md/index");
    expect(middleware(req("/about", "text/markdown")).headers.get("x-middleware-rewrite")).toBe("https://townhall.town/md/about");
  });
  it("rewrites unknown Markdown paths to the Markdown 404", () => {
    const res = middleware(req("/__probe", "text/markdown"));
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://townhall.town/md/404?path=%2F__probe");
  });
  it("passes HTML through with Vary: Accept", () => {
    const res = middleware(req("/", "text/html"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("vary")).toContain("Accept");
  });
  it("does not match API routes, assets or files", () => {
    const re = new RegExp("^" + config.matcher[0] + "$");
    for (const p of ["/", "/about", "/__probe", "/a/b"]) expect(re.test(p)).toBe(true);
    for (const p of ["/api/agent", "/_next/static/x.js", "/llms.txt", "/sitemap.xml", "/robots.txt", "/md/index", "/opengraph-image", "/favicon.ico"])
      expect(re.test(p)).toBe(false);
  });
});
