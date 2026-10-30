// QA P1 (Oct 30): Towny's SF early-voting/where replies linked only sf.gov. They also link the SF Department of Elections
// polling place lookup and the Voter Portal, read from data/polling_locations.json (no hardcoded URLs).
import { describe, it, expect } from "vitest";
import { curated } from "../lib/towny/answer";
import { faqFor, pollingLinks } from "../lib/towny/faq";
import { dedupeByHost } from "../lib/townyChat";
import { SF_LOOKUP_LABEL } from "../lib/endscreen.mjs";
import polls from "../data/polling_locations.json";

const sf = (polls as any).zips["94103"];
const LOOKUP = { label: SF_LOOKUP_LABEL, url: sf.lookupUrl };
const PORTAL = { label: "Voter Portal", url: sf.portalUrl };

describe("SF early-voting/where replies link the polling lookup and the Voter Portal", () => {
  it("pollingLinks comes from the data, 94103 only", () => {
    expect(pollingLinks("94103")).toEqual([LOOKUP, PORTAL]);
    expect(pollingLinks("78701")).toEqual([]);
    expect(pollingLinks("10001")).toEqual([]);
  });
  for (const q of ["When does early voting end?", "Where do I vote?", "When and where do I vote?", "Where is my polling place?"]) {
    it(`curated 94103: ${q}`, () => {
      const c = curated("94103", q, "2026-10-30")!;
      const urls = c.links.map((l) => l.url);
      expect(urls).toContain(LOOKUP.url);
      expect(urls).toContain(PORTAL.url);
      expect(c.links).toContainEqual(LOOKUP);
      expect(c.links).toContainEqual(PORTAL);
      expect(urls.some((u) => /sf\.gov/.test(u))).toBe(true);
      expect(new Set(urls).size).toBe(urls.length);
    });
  }
  it("the panel's client FAQ path keeps both after its host dedupe", () => {
    const f = faqFor("Where do I vote?", "94103", "2026-10-30")!;
    expect(dedupeByHost(f.links)).toEqual(f.links);
    expect(f.links).toContainEqual(PORTAL);
  });
  it("other ZIPs unchanged: one link per host", () => {
    for (const z of ["78701", "10001"]) {
      const urls = curated(z, "Where do I vote?", "2026-10-30")!.links.map((l) => new URL(l.url).hostname);
      expect(new Set(urls).size).toBe(urls.length);
    }
  });
});
