import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ballotFor } from "../lib/tools";
import { impactOf, tierFor } from "../app/RaceTiers";
import { pageTopics, quoteFits } from "../lib/research";
import { plain } from "../lib/plain";
import { openApiSpec } from "../lib/openapi";

const src = (f: string) => readFileSync(f, "utf8");
const races = (z: string) => (ballotFor(z)!.races as any[]);

describe("QA 4c21a5c P1-1: race ranking keys on id/level, not display title", () => {
  it("pins tier counts per ZIP (most/high/moderate/lower over races)", () => {
    // Oct 29 (round 2): sourced race ratings (Cook/Sabato/Inside Elections) are back; Kalshi-only ratings are dropped.
    // vs 9dfe90d (78701 2/1/7/48, 94103 0/2/8/22): tx-agcomm, tx-rrc, ca-insurance and sf-supervisor-8 were "competitive"
    // only from a Kalshi price, so each drops one tier. No live market here; Polymarket can only raise a race.
    const want: Record<string, number[]> = { "78701": [2, 0, 7, 49], "94103": [0, 1, 8, 23], "10001": [0, 1, 3, 9] };
    for (const [z, w] of Object.entries(want)) {
      const c = { most: 0, high: 0, moderate: 0, lower: 0 };
      for (const r of races(z)) c[tierFor(r).tier]++;
      expect([c.most, c.high, c.moderate, c.lower], z).toEqual(w);
    }
  });
  it("certified titles 'U.S. Senator' and 'U.S. Representative, District N' rank as federal", () => {
    expect(impactOf({ id: "us-senate-tx", title: "U.S. Senator", level: "federal" } as never)).toEqual({ v: 3, why: "top federal or statewide office" });
    expect(impactOf({ id: "tx-10", title: "U.S. Representative, District 10", level: "federal" } as never)).toEqual({ v: 2, why: "your U.S. House seat" });
    expect(impactOf({ id: "x", title: "U.S. House Texas District 37", level: "federal" } as never).why).toBe("your U.S. House seat");
    const sen = races("78701").find((r) => r.id.startsWith("us-senate"));
    expect(sen.title).toBe("U.S. Senator");
    expect(impactOf(sen).why).toBe("top federal or statewide office");
  });
});

describe("QA 4c21a5c P1-2: judicial note links its source on every judicial race", () => {
  it("all 3 ZIPs", () => {
    let n = 0;
    for (const z of ["78701", "94103", "10001"]) for (const r of races(z).filter((r) => r.judicial)) {
      n++;
      expect(r.judicialNote, r.id).toBeTruthy();
      expect(r.judicialNoteSource?.url, r.id).toMatch(/^https:\/\//);
      expect(r.judicialNoteSource?.label, r.id).toMatch(/Canon|NYCRR/);
    }
    expect(n).toBeGreaterThan(5);
    expect(src("app/RaceTiers.tsx")).toContain("data-judicial-source");
  });
});

describe("QA 4c21a5c P2: research cache header and per-instance rate limit", () => {
  it("fresh runs say x-research-cache: miss and the counter falls per call on one instance", async () => {
    const { GET } = await import("../app/api/research/route");
    const id = races("78701").find((r) => r.judicial).id;
    const h = { headers: { "x-forwarded-for": "203.0.113.201" } };
    const a = await GET(new Request(`https://x/api/research?zip=78701&race=${id}`, h)); await a.text();
    const b = await GET(new Request(`https://x/api/research?zip=78701&race=${id}`, h)); await b.text();
    expect(a.headers.get("x-research-cache")).toBe("miss");
    expect(a.headers.get("ratelimit-remaining")).toBe("9");
    expect(b.headers.get("ratelimit-remaining")).toBe("8");
    expect(b.headers.get("x-research-cache")).toBe("hit");
    expect(b.headers.get("x-research-cache-layer")).toBe("run");
  });
  it("openapi documents hit/miss and per-instance counters", () => {
    const r = (openApiSpec() as any).paths["/api/research"].get.responses["200"];
    expect(r.headers["x-research-cache"].schema.enum).toEqual(["hit", "partial", "miss"]);
    expect(r.headers["x-research-cache-layer"].schema.enum).toEqual(["run", "search+pages", "none"]);
    expect(r.description).toMatch(/per server instance/);
  });
});

describe("QA 4c21a5c P2: research quotes must fit the issue", () => {
  it("page topic comes from the URL path", () => {
    expect(pageTopics("https://www.xavierbecerra2026.com/priorities/health-care/")).toEqual(["healthcare"]);
    expect(pageTopics("https://www.xavierbecerra2026.com/priorities/homelessness/")).toEqual(["housing"]);
    expect(pageTopics("https://www.xavierbecerra2026.com/priorities/")).toEqual([]);
  });
  it("drops a housing quote from a health-care page, keeps housing pages and topic-less pages", () => {
    const q = (quote: string, issue = "housing") => ({ issue, quote });
    expect(quoteFits(q("I will establish a fund offering housing assistance in high-cost areas for health workers."), "https://www.xavierbecerra2026.com/priorities/health-care/")).toBe(false);
    expect(quoteFits(q("Californians pay some of the highest rents in the nation."), "https://www.xavierbecerra2026.com/priorities/housing/")).toBe(true);
    expect(quoteFits(q("As governor, I will treat housing like the essential infrastructure it is."), "https://www.xavierbecerra2026.com/priorities/")).toBe(true);
    expect(quoteFits(q("We have plans to end mass homelessness by the end of my first year."), "https://www.cbsnews.com/sanfrancisco/news/steve-hilton-campaign-stop-san-francisco/")).toBe(true);
  });
  it("drops endorsement statements, which are not issue positions", () => {
    expect(quoteFits({ issue: "immigration", quote: "To be endorsed by the President of the United States, on a personal level, as an immigrant, I am proud" }, "https://www.cbsnews.com/sanfrancisco/news/steve-hilton-campaign-stop-san-francisco/")).toBe(false);
    expect(src("app/api/research/route.ts")).toMatch(/filter\(\(x\) => quoteFits\(x, u\)\)/);
  });
});

describe("QA 4c21a5c P2: labels", () => {
  it("10001 judicial races are judicial seats, BOE is a state office", () => {
    for (const r of races("10001").filter((r) => r.judicial)) expect(impactOf(r).why, r.id).toBe("judicial seat");
    const boe = races("94103").find((r) => /board of equalization/i.test(r.title));
    expect(boe).toBeTruthy();
    expect(impactOf(boe).why).toBe("state office");
    for (const z of ["78701", "94103", "10001"]) for (const r of races(z).filter((r) => r.judicial)) expect(impactOf(r).why).toBe("judicial seat");
  });
  it("10001 split notes name the real source (NYC BOE contest list), not 'draft contest list'", () => {
    const notes = races("10001").map((r) => plain(String(r.appliesNote || ""))).filter((n) => /Source/.test(n));
    expect(notes.length).toBeGreaterThan(0);
    // Superseded by Civic qa_fixes4 (Oct 30): the note is Civic's per-race text, which names the list and its print date.
    for (const n of notes) { expect(n).not.toMatch(/Source: draft contest list/); expect(n).toMatch(/NYC (Board of Elections|BOE) (contest )?list.*9\/11\/2026/); } // shortened by Civic qa_fixes7 #3
  });
});

describe("QA 4c21a5c P2: chat carry-over and 300% zoom", () => {
  it("carry-over notice is on the page, not only in the chat", () => {
    const s = src("app/TownyInterview.tsx");
    expect(s).toContain("data-carryover");
    expect(s.match(/\{carry\}/g)?.length).toBe(2);
  });
  it("candidate names wrap with the full name in title (QA 94cf301 replaces design p8's ellipsis)", () => {
    const s = src("components/PortraitRow.tsx");
    expect(s).toMatch(/line-clamp-3[^`]*`\} title=\{c\.name\} aria-label=\{c\.name\}/);
    expect(s).not.toMatch(/text-ellipsis|break-all/);
  });
  it("hero top padding only grows on tall viewports (no ~300px band at 300% zoom)", () => {
    const s = src("app/page.tsx");
    // Design p8: pt-12 lg:pt-20; purple spec P1-3 adds 160px only when the viewport is also >= 800px tall.
    // Design P1 (Oct 30, 3:38 PM CT) supersedes purple P1-3: py-16 at 1440, no tall-viewport pt-40 at all.
    expect(s).toContain('pb-10 pt-12 lg:pt-16" data-hero');
    expect(s).not.toMatch(/pt-40|sm:pt-/);
  });
});
