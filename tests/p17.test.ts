// Civic qa12/qa13 photos + QA 94cf301 fixes (Oct 30, 6:53-7:00 AM CT).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { townyFact } from "../lib/townyFacts";
import { gradesAbsentLine, GRADES_ABSENT_LINE, GRADES_OVERLAP_LINE, gradesForRace } from "../lib/grades.mjs";
import { getElectionDates } from "../lib/logistics";
import { whereFor } from "../lib/endscreen.mjs";
const J = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const P = J("data/photos.json"); const M = J("data/portraits-manifest.json").portraits; const B = J("data/civic/photos_batch.json");

describe("qa12/qa13 photos", () => {
  it("Krist and Benathen are self-hosted from Civic's localFiles (never regents.nysed.gov fetched); Bhatti is a takedown (Design 7:37 AM)", () => {
    for (const id of ["brian-j-krist", "steven-benathen"]) {
      expect(P.selfHosted[id]?.file, id).toBe(`/portraits/${id}-160.webp`);
      expect(M[id].localFile, id).toBe(`/workspace/townhall/civic/photos_local/${id}.jpg`);
    }
    expect(M["haris-bhatti"]).toBeUndefined();
  });
  it("Frankola-Crawford has no image in either mode", () => {
    expect(J("data/photo_takedowns.json")).toContain("jennifer-frankola-crawford");
    expect(B["jennifer-frankola-crawford"]?.photoUrl ?? null).toBeNull();
    expect(P.selfHosted["jennifer-frankola-crawford"]).toBeUndefined();
    expect(P.hotlinked["jennifer-frankola-crawford"]).toBeUndefined();
  });
  it("credits render the batch attribution as written", () => {
    expect(P.selfHosted["brian-j-krist"].credit).toBe("Brian J. Krist's official page");
    expect(P.selfHosted["steven-benathen"].credit).toBe("Steven Benathen's own LinkedIn profile");
    for (const id of ["caroline-shinkle", "elisabeth-earle", "scott-brister", "vikki-goodwin"]) {
      expect(P.selfHosted[id].credit, id).toMatch(/'s campaign site$/);
      expect(P.selfHosted[id].sourceUrl, id).toBe(B[id].photoUrl);
    }
    expect(M["vikki-goodwin"].precrop).toEqual({ left: 100, top: 60, width: 660, height: 660 });
  });
  it("NY notes say 'printed 9/11/2026' and stay within 200", () => {
    const n = J("data/ny-applies-notes.json").byRace;
    for (const id of ["ny-civil-3md-ny", "ny-civil-9md-ny", "nyc-council-3"]) { expect(n[id]).toMatch(/printed 9\/11\/2026, still TENTATIVE/); expect(n[id].length).toBeLessThanOrEqual(200); }
  });
});

describe("QA 94cf301 fixes", () => {
  it("(a) explainer gives the overlap reason separately; missing-records sentence unchanged", () => {
    expect(GRADES_ABSENT_LINE).toBe("Letters need sourced records for every candidate.");
    expect(gradesAbsentLine("overlap")).toBe(GRADES_OVERLAP_LINE);
    for (const h of ["eligibility", "scored"]) expect(gradesAbsentLine(h)).toBe(GRADES_ABSENT_LINE);
    expect(GRADES_OVERLAP_LINE).not.toMatch(/\bbest\b|vote for/i);
  });
  it("(d) Towny answers ballot and early-voting questions from shipped data only", () => {
    const ev = getElectionDates("78701")!.earlyVoting;
    const a = townyFact("78701", "When does early voting end?", "2026-10-29")!;
    expect(a.reply).toContain("The last day is Oct 30.");
    expect(a.links[0]).toEqual({ label: "Early voting source", url: ev.sourceUrl });
    expect(townyFact("78701", "When does early voting end?", "2026-10-31")!.reply).toContain("ended on Oct 30");
    expect(townyFact("10001", "What's on my ballot?")!.reply).toMatch(/^Your 10001 ballot has \d+ races?/);
    expect(townyFact("94103", "rents are too high")).toBeNull();
    for (const z of ["78701", "94103", "10001"]) { const f = townyFact(z, "what's on my ballot")!; expect(f.reply).not.toMatch(/\bbest\b|vote for|https?:/i); expect(f.links[0].url).toMatch(/^https:\/\//); }
  });
});

describe("QA 0e605d9 Towny follow-up", () => {
  it("says 'ends today' on the last day (CT), like the page", () => {
    expect(townyFact("78701", "When does early voting end?", "2026-10-30")!.reply).toMatch(/^Early voting in Travis County, TX ends today, Friday, October 30\./);
    expect(townyFact("10001", "When does early voting end?", "2026-10-30")!.reply).not.toMatch(/ends today/);
    expect(townyFact("10001", "When does early voting end?", "2026-11-01")!.reply).toMatch(/ends today, Sunday, November 1/);
  });
  it("uses Civic qa14's hours wording as written (county line with the 10 PM sites, then the site's own line)", () => {
    const r = townyFact("78701", "When does early voting end?", "2026-10-30")!;
    const ev = getElectionDates("78701")!.earlyVoting; const site = (whereFor("78701", "2026-10-30") as any).sites[0];
    expect(ev.hours).toMatch(/^7:00 AM-7:00 PM daily \(Monday-Sunday\), Mon Oct 19-Fri Oct 30 \(last day\)\. On Thu Oct 29 and Fri Oct 30 only, 7 sites stay open to 10:00 PM/);
    expect(site.hours).toBe("7:00 AM-7:00 PM daily, including Thu Oct 29 and Fri Oct 30 (last day). This site closes at 7:00 PM; it is not one of the 7 sites open to 10:00 PM.");
    expect(r.reply).toBe(`Early voting in Travis County, TX ends today, Friday, October 30. Hours: ${ev.hours} ${site.name}: ${site.hours}`);
    expect(r.links.map((l) => l.url)).toContain(site.sourceUrl);
    for (const z of ["78701", "94103", "10001"]) expect(townyFact(z, "When does early voting end?", "2026-10-30")!.reply).not.toMatch(/https?:|dailyHours/);
  });
  it("qa14: starred sites UT Texas Union and Millennium say 10 PM", () => {
    const sites = J("data/polling_locations.json").zips["78701"].earlyVoting;
    // qa15: UT Texas Union trimmed (Millennium unchanged).
    expect(sites.find((s: any) => /Texas Union/.test(s.name)).hours).toBe("7:00 AM-7:00 PM Oct 19-28; 7:00 AM-10:00 PM Thu Oct 29 and Fri Oct 30 (last day)");
    expect(sites.find((s: any) => /Millennium/.test(s.name)).hours).toBe("7:00 AM-7:00 PM Oct 19-28; 7:00 AM-10:00 PM Thu Oct 29 and Fri Oct 30 (last day). One of 7 extended-hours sites (marked * on the county list).");
    expect(J("data/civic/polling_locations.json")).toEqual(J("data/polling_locations.json"));
  });

});

describe("qa14 credits", () => {
  it("render the rebuilt batch attribution as written", () => {
    expect(P.selfHosted["mike-trouble-lin"].credit).toBe("Mike Trouble Lin's own Linktree page");
    expect(P.selfHosted["sarah-eckhardt"].credit).toBe("Jeffrey Clemmons via Wikimedia Commons"); // qa15
    expect(P.selfHosted["greg-casar"].credit).toBe("Greg Casar's official House portrait"); // qa15
    expect(B["greg-casar"].officialPageOwner).toBe("U.S. House of Representatives");
  });
});

describe("Design 7:37 AM: Haris Bhatti initials", () => {
  it("is a takedown, has no shipped file, and Carl Wilson keeps his", () => {
    expect(J("data/photo_takedowns.json")).toContain("haris-bhatti");
    expect(P.selfHosted["haris-bhatti"]).toBeUndefined();
    expect(fs.existsSync("public/portraits/haris-bhatti-160.webp")).toBe(false);
    expect(P.selfHosted["carl-wilson"]).toBeDefined();
    for (const id of ["bunny-mcfadden", "pearci-pj-bastiany-iii"]) expect(fs.existsSync(`public/portraits/${id}-160.webp`)).toBe(true);
  });
});
