import { describe, expect, it } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { homeJsonLd, jsonLdString } from "../lib/jsonld";

describe("sitemap", () => {
  it("lists every page with an absolute URL and lastmod", () => {
    const s = sitemap();
    expect(s.map((e) => e.url)).toEqual([
      "https://townhall.town/",
      "https://townhall.town/about",
      "https://townhall.town/contact",
      "https://townhall.town/privacy",
    ]);
    for (const e of s) expect(String(e.lastModified)).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

describe("robots", () => {
  it("allows all agents and points to the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules[0]).toMatchObject({ userAgent: "*", allow: "/" });
    expect(JSON.stringify(rules)).not.toMatch(/"disallow":"\/"|"disallow":\["\/"\]/);
    expect(r.sitemap).toBe("https://townhall.town/sitemap.xml");
  });
});

describe("JSON-LD", () => {
  const ld = JSON.parse(jsonLdString(homeJsonLd()));
  const byType = (t: string) => ld["@graph"].find((n: any) => n["@type"] === t);
  it("has a WebApplication with the required fields", () => {
    const app = byType("WebApplication");
    expect(app).toMatchObject({ name: "townhall.town", url: "https://townhall.town", operatingSystem: "Web", isAccessibleForFree: true });
    expect(app.description.length).toBeGreaterThan(20);
    expect(app.applicationCategory).toBeTruthy();
    expect(app.offers).toMatchObject({ "@type": "Offer", price: "0" });
    expect(app.sameAs).toContain("https://github.com/adamtpang/townhall.town");
  });
  it("has an Organization with a support contactPoint and no private details", () => {
    const org = byType("Organization");
    expect(org).toMatchObject({ name: "townhall.town", url: "https://townhall.town" });
    expect(org.contactPoint).toMatchObject({ contactType: "customer support", url: "https://github.com/adamtpang/townhall.town/issues" });
    const s = JSON.stringify(ld);
    expect(s).not.toContain("PostalAddress");
    expect(s).not.toMatch(/"(email|telephone)"/);
  });
  it("escapes < so it cannot close the script tag", () => {
    expect(jsonLdString({ a: "</script>" })).not.toContain("</script>");
  });
});
