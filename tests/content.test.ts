import { describe, expect, it } from "vitest";
import { GET } from "../app/md/[page]/route";
import { ABOUT, CONTACT, CONTENT, HOME_SECTIONS, PRIVACY, notFoundMarkdown, pageMarkdown, type PageContent } from "../lib/content";
import { llmsFullTxt, llmsTxt } from "../lib/llms";
import { PAGES } from "../lib/site";

// Visible text of a page: lead plus sections, with Markdown links reduced to their text.
const text = (p: PageContent) =>
  [p.title, p.lead, ...p.sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.items ?? [])])]
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

const call = (page: string, path?: string) =>
  GET(new Request(`https://townhall.town/md/${page}${path ? `?path=${encodeURIComponent(path)}` : ""}`), { params: Promise.resolve({ page }) });

describe("trust pages", () => {
  it.each([ABOUT, CONTACT, PRIVACY])("$path has at least 500 characters of real content", (p) => {
    expect(text(p).length).toBeGreaterThanOrEqual(500);
  });
  it("about states the facts", () => {
    const t = text(ABOUT);
    for (const s of ["nonpartisan", "unsure", "github.com/adamtpang/townhall.town", "Adam Pang", "MIT"]) expect(t.toLowerCase() + ABOUT.sections.map((x) => x.paragraphs?.join(" ")).join(" ")).toContain(s.toLowerCase());
  });
  it("privacy states storage, accounts and AI processing", () => {
    const t = text(PRIVACY);
    for (const s of ["localStorage", "no OAuth", "Vercel AI Gateway", "does not include analytics"]) expect(t).toContain(s);
  });
  it("contact uses GitHub issues and publishes no personal email or phone", () => {
    const all = JSON.stringify(CONTACT);
    expect(all).toContain("https://github.com/adamtpang/townhall.town/issues");
    expect(all).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(all).not.toMatch(/\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/);
  });
});

describe("copy rules", () => {
  const all = [JSON.stringify(CONTENT), JSON.stringify(HOME_SECTIONS), llmsFullTxt(), notFoundMarkdown("/x")].join("\n");
  it("has no em dashes", () => expect(all).not.toContain("\u2014"));
  it("has no endorsement language", () => {
    expect(all).not.toMatch(/\bbest\b/i);
    expect(all).not.toMatch(/vote for/i);
  });
});

describe("markdown twins", () => {
  it.each(PAGES.map((p) => [p]))("%s renders nonempty Markdown with an H1", (p) => {
    const md = pageMarkdown(p);
    expect(md.startsWith("# ")).toBe(true);
    expect(md.length).toBeGreaterThan(300);
  });
  it("route returns text/markdown with Vary: Accept", async () => {
    const res = await call("index");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
    expect(await res.text()).toContain("# townhall.town");
  });
  it("route returns a Markdown 404 linking llms.txt and the sitemap", async () => {
    const res = await call("404", "/__probe");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const body = await res.text();
    expect(body.length).toBeGreaterThanOrEqual(20);
    expect(body).toContain("/__probe");
    expect(body).toContain("https://townhall.town/llms.txt");
    expect(body).toContain("https://townhall.town/sitemap.xml");
    expect((await call("nope")).status).toBe(404);
  });
});

describe("llms.txt", () => {
  const t = llmsTxt();
  it("follows llmstxt.org structure: H1, blockquote, H2 sections", () => {
    const lines = t.split("\n");
    expect(lines[0]).toBe("# townhall.town");
    expect(lines.find((l) => l.trim())).toMatch(/^# /);
    expect(t).toMatch(/\n> \S/);
    expect(t.match(/^# /gm)).toHaveLength(1);
    expect(t).toMatch(/^## When to use this$/m);
    expect(t).toMatch(/^## How to call it$/m);
    expect(t).toMatch(/^## Optional$/m);
  });
  it("names the covered ZIPs and only real API routes", () => {
    for (const z of ["78701", "94103", "10001"]) expect(t).toContain(z);
    const apis = [...t.matchAll(/\/api\/(?:v1\/)?([a-z]+)\b/g)].map((m) => m[1]);
    expect(new Set(apis)).toEqual(new Set(["agent", "locate"]));
  });
  it("llms-full.txt includes every page", () => {
    const f = llmsFullTxt();
    for (const p of PAGES) expect(f).toContain(`Source: https://townhall.town${p}`);
  });
});
