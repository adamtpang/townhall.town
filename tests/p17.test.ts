// Civic qa12/qa13 photos + QA 94cf301 fixes (Oct 30, 6:53-7:00 AM CT).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { townyFact } from "../lib/townyFacts";
import { gradesAbsentLine, GRADES_ABSENT_LINE, GRADES_OVERLAP_LINE, gradesForRace } from "../lib/grades.mjs";
import { getElectionDates } from "../lib/logistics";
const J = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const P = J("data/photos.json"); const M = J("data/portraits-manifest.json").portraits; const B = J("data/civic/photos_batch.json");

describe("qa12/qa13 photos", () => {
  it("Krist, Benathen and Bhatti are self-hosted from Civic's localFiles (never regents.nysed.gov fetched)", () => {
    for (const id of ["brian-j-krist", "steven-benathen", "haris-bhatti"]) {
      expect(P.selfHosted[id]?.file, id).toBe(`/portraits/${id}-160.webp`);
      expect(M[id].localFile, id).toBe(`/workspace/townhall/civic/photos_local/${id}.jpg`);
    }
    expect(M["haris-bhatti"].sourceSize).toEqual([270, 340]); // Civic's pre-cropped solo box (330,80)-(600,420)
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
    const a = townyFact("78701", "When does early voting end?", "2026-10-30")!;
    expect(a.reply).toContain("The last day is Oct 30.");
    expect(a.sourceUrl).toBe(ev.sourceUrl);
    expect(townyFact("78701", "When does early voting end?", "2026-10-31")!.reply).toContain("ended on Oct 30");
    expect(townyFact("10001", "When does early voting end?", "2026-10-30")!.reply).not.toMatch(/dailyHours/);
    expect(townyFact("10001", "What's on my ballot?")!.reply).toMatch(/^Your 10001 ballot has \d+ races?/);
    expect(townyFact("94103", "rents are too high")).toBeNull();
    for (const z of ["78701", "94103", "10001"]) expect(townyFact(z, "what's on my ballot")!.reply).not.toMatch(/\bbest\b|vote for/i);
  });
});
