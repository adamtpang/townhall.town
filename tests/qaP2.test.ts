import { describe, expect, it } from "vitest";
import { plain } from "../lib/plain";
import { txTitle, ballotFor } from "../lib/tools";
import { raceMeta } from "../lib/raceMeta";
import { buildIcs } from "../lib/endscreen.mjs";
import { newsDate } from "../app/RaceTiers";

describe("QA P2 (60582ae)", () => {
  it("plain(): no ZCTA / edge artifact / TENTATIVE / ACS jargon, numbers kept", () => {
    const s = plain("SPLIT (sliver): ~0.4% of 94103 (ZCTA) residents, about 163 people, fall in District 10. This may be an edge artifact of using the ZCTA instead of the USPS ZIP; verify by address");
    expect(s).toBe("~0.4% of 94103 residents, about 163 people, fall in District 10. Check by address.");
    expect(plain("Source: TENTATIVE contest list")).toBe("Source: draft contest list");
    expect(plain("rent (ACS 2024 5-year (2020-2024), ZCTA level, via Census Reporter).")).toBe("rent (Census estimate, 2020\u20132024, via Census Reporter).");
    expect(plain("Table B29001 count")).not.toMatch(/B29001/);
  });
  it("no jargon in any rendered appliesNote", () => {
    // NYC rows with Civic's per-race source text (qa_fixes4) keep TENTATIVE by design; the jargon check covers the rest.
    for (const z of ["78701", "94103", "10001"]) for (const r of ballotFor(z)!.races as { appliesNote?: string; splitNote?: string; sourceNote?: string }[])
      expect(plain(r.sourceNote ? r.splitNote : r.appliesNote)).not.toMatch(/ZCTA|edge artifact|TENTATIVE|ACS|B29001/);
  });
  it("one authority line per power on 94103 Governor", () => {
    const a = raceMeta("94103", "ca-gov")!.why!.authority;
    const roles = a.map((x) => x.role + x.sourceUrl);
    expect(new Set(roles).size).toBe(roles.length);
    expect(a.some((x) => x.issues.length > 1)).toBe(true);
  });
  it("news dates read like Oct 1, 2026", () => {
    expect(newsDate("2026-10-01")).toBe("Oct 1, 2026");
    expect(newsDate("2026-12-31")).toBe("Dec 31, 2026");
  });
  it("78701 race names use 'Office, District N'", () => {
    expect(txTitle("Texas House District 49")).toBe("State Representative, District 49");
    const titles = ballotFor("78701")!.races.map((r) => r.title);
    expect(titles).toContain("State Representative, District 49");
    expect(titles).toContain("State Representative, District 51");
    expect(titles.some((t) => /^Texas House District|^U\.S\. House Texas/.test(t))).toBe(false);
  });
  it(".ics: no alarm on a multi-day window, alarm kept on a single day", () => {
    const base = { allDay: true, details: "d", sourceUrl: "https://example.org" };
    const ics = buildIcs([{ ...base, uid: "ev", title: "Early voting", start: "2026-10-19", end: "2026-10-30" }, { ...base, uid: "ed", title: "Election Day", start: "2026-11-03", end: "2026-11-03" }], "", 0);
    const ev = ics.split("BEGIN:VEVENT")[1], ed = ics.split("BEGIN:VEVENT")[2];
    expect(ev).not.toMatch(/VALARM/);
    expect(ed).toMatch(/TRIGGER:-PT12H/);
  });
});
