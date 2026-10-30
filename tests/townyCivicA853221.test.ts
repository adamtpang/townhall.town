// Civic review of a853221: SF lookup label, portalUrl split out of the note, 787xx same-city line names ZIPs, "the SF Department of Elections".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { whereFor, SF_LOOKUP_LABEL } from "../lib/endscreen.mjs";
import { whenWhere } from "../lib/towny/faq";
import { SAME_CITY } from "../lib/townyChat";
import { curated } from "../lib/towny/answer";

const J = (f: string) => JSON.parse(readFileSync(new URL("..", import.meta.url).pathname + f, "utf8"));
const src = (f: string) => readFileSync(new URL("..", import.meta.url).pathname + f, "utf8");

describe("end screen SF polling link", () => {
  it("same URL, labeled by the SF Department of Elections", () => {
    const w = whereFor("94103", "2026-10-30");
    expect(w.lookupUrl).toBe("https://sfelections.org/tools/map_poll_time/");
    expect(w.lookupLabel).toBe("SF Department of Elections polling place lookup");
    expect(SF_LOOKUP_LABEL).toBe("SF Department of Elections polling place lookup");
    expect(whereFor("10001", "2026-10-30").lookupLabel).toBeNull();
    expect(whereFor("78701", "2026-10-30").lookupLabel).toBeNull();
    expect(src("app/EndScreen.tsx")).toContain('{where.lookupLabel ?? "Find your assigned polling place"}');
  });
});

describe("polling_locations.json portalUrl", () => {
  for (const f of ["data/polling_locations.json", "data/civic/polling_locations.json"]) it(f, () => {
    const sf = J(f).zips["94103"];
    expect(sf.portalUrl).toBe("https://sfelections.org/tools/portal/");
    expect(sf.lookupUrlNote).not.toContain("sfelections.org/tools/portal");
    expect(sf.lookupUrlNote).toContain("also the Voter Portal and the back cover of the Voter Information Pamphlet.");
  });
});

describe("787xx same-city line", () => {
  const ATX = "Towny shows the ballot for ZIP 78701 in downtown Austin. Ballots in other ZIPs have different races. For yours, check your county election office or vote.gov.";
  it("exact text, links unchanged", () => {
    expect(SAME_CITY["78701"].reply).toBe(ATX);
    expect(SAME_CITY["78701"].links).toEqual([{ label: "vote.gov", url: "https://vote.gov" }]);
    for (const q of ["78759", "What's on my ballot in 78738?"]) {
      const r = curated("78701", q)!;
      expect(r.reply).toBe(ATX);
      expect(r.links.map((l) => l.url)).toEqual(["https://vote.gov"]);
    }
  });
});

describe("when/where office name", () => {
  it("'the' for SF only", () => {
    expect(whenWhere("94103", "2026-10-30").a).toMatch(/For hours and polling places, check the SF Department of Elections\.$/);
    expect(whenWhere("78701", "2026-10-30").a).toMatch(/For hours and polling places, check Travis County Elections\.$/);
    expect(whenWhere("10001", "2026-10-30").a).toMatch(/For hours and polling places, check NYC Board of Elections\.$/);
  });
});
