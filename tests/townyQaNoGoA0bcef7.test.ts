// QA NO-GO on preview a0bcef7 (Oct 30, 2:36-2:44 PM CT): P0 ballot-order claims, P0 78613 on /api/interview, SF where/portal P1s.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { curated } from "../lib/towny/answer";
import { OUT_OF_SCOPE, routeTurn } from "../lib/townyChat";
import { whereFor, SF_LOOKUP_LABEL } from "../lib/endscreen.mjs";

const root = new URL("..", import.meta.url).pathname;
const src = (f: string) => readFileSync(join(root, f), "utf8");
const polls = JSON.parse(src("data/polling_locations.json")).zips;
// Code only: strip /* */ and // comments so code comments that describe ordering are not counted as user-facing copy.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(root, dir))) {
    const p = join(dir, n);
    if (statSync(join(root, p)).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|js)$/.test(n)) out.push(p);
  }
  return out;
}

describe("P0-1: no unqualified ballot-order claim anywhere in the app", () => {
  // lib/townyPrompt.ts is a model instruction (not shown to voters) and is owned elsewhere; it is not changed here.
  const files = [...walk("app"), ...walk("components"), ...walk("lib")].filter((f) => !f.endsWith("townyPrompt.ts"));
  it("no 'in ballot order' / 'Candidates are in ballot order' / aria-label claim in code or i18n", () => {
    const hits = files.filter((f) => /in ballot order|candidates are (shown |listed )?in ballot order|ballot order in our data/i.test(code(src(f))));
    expect(hits).toEqual([]);
  });
  it("the dead i18n key is gone", () => {
    expect(src("lib/i18n.tsx")).not.toMatch(/Candidates are shown in ballot order/);
  });
  it("the photo row's screen-reader label makes no order claim", () => {
    expect(src("components/PortraitRow.tsx")).not.toMatch(/aria-label="[^"]*ballot order/i);
  });
});

describe("P0-2: another ZIP never gets the page ZIP's ballot", () => {
  const Q = "I'm in 78613, what's on my ballot?";
  it("curated: 78613 is out of scope with vote.gov, for every page ZIP", () => {
    for (const z of ["78701", "94103", "10001"]) {
      const c = curated(z, Q)!;
      expect(c.intent).toBe("out-of-scope");
      expect(c.reply).toBe(OUT_OF_SCOPE);
      expect(c.reply).not.toMatch(/78701 ballot has/);
      expect(c.links.map((l) => l.url)).toEqual(["https://vote.gov"]);
    }
    for (const q of ["78664 ballot?", "What's on the ballot in 90210?", "I live in 77002"]) expect(curated("78701", q)!.reply).toBe(OUT_OF_SCOPE);
  });
  it("78745 keeps the same-city line; 77002 never names Houston", () => {
    expect(curated("78701", "I'm in 78745, what's on my ballot?")!.intent).toBe("same-city");
    expect(curated("78701", "77002")!.reply).not.toMatch(/houston/i);
  });
  it("server and panel agree", () => {
    expect(routeTurn(Q, "78701")).toMatchObject({ kind: "fixed", reply: OUT_OF_SCOPE });
  });
  it("POST /api/interview answers 78613 with OUT_OF_SCOPE and vote.gov", async () => {
    const { POST } = await import("../app/api/interview/route");
    const r = await POST(new Request("https://x/api/interview", { method: "POST", body: JSON.stringify({ zip: "78701", messages: [{ text: Q }] }), headers: { "x-forwarded-for": "203.0.113.90", "content-type": "application/json" } }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.reply).toBe(OUT_OF_SCOPE);
    expect(j.links).toEqual([{ label: "vote.gov", url: "https://vote.gov" }]);
  });
});

describe("P1: SF where to vote names the SF Department of Elections and links the lookup and the portal from the data", () => {
  const sf = polls["94103"];
  it("chat answer", () => {
    const c = curated("94103", "where do I vote and what are the hours?", "2026-10-30")!;
    expect(c.reply).toMatch(/SF Department of Elections/);
    const urls = c.links.map((l) => l.url);
    expect(urls).toContain(sf.lookupUrl);
    expect(urls).toContain(sf.portalUrl);
    expect(c.links.find((l) => l.url === sf.lookupUrl)!.label).toBe(SF_LOOKUP_LABEL);
  });
  it("whereFor carries the lookup label and the portal from data/polling_locations.json", () => {
    const w = whereFor("94103", "2026-10-30") as { lookupUrl: string; lookupLabel: string; portalUrl: string };
    expect(w.lookupUrl).toBe("https://sfelections.org/tools/map_poll_time/");
    expect(w.lookupLabel).toBe(SF_LOOKUP_LABEL);
    expect(w.portalUrl).toBe("https://sfelections.org/tools/portal/");
    expect(sf.portalUrl).toBe("https://sfelections.org/tools/portal/");
    expect((whereFor("78701", "2026-10-30") as { portalUrl: string | null }).portalUrl).toBeNull();
  });
  it("the card and the results page render the lookup label and the portal link", () => {
    const card = src("app/card/BallotCard.tsx");
    // Merge with feat/print-ballot: the card's Where tile keeps its own fallback label; SF still gets where.lookupLabel.
    expect(card).toMatch(/where\.lookupLabel \?\? (tr\("Find your polling place"\)|"Find your assigned polling place")/);
    expect(card).toMatch(/href=\{where\.portalUrl\}[^>]*data-card-portal>Voter Portal/);
    expect(card).not.toMatch(/>Find your assigned polling place ↗</);
    expect(src("app/EndScreen.tsx")).toMatch(/href=\{where\.portalUrl\}[^>]*data-end-portal>Voter Portal/);
  });
});
