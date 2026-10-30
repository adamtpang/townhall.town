import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { voteMatters } from "../lib/voteMatters.mjs";
import { ballotFor, getLocalProblems } from "../lib/tools";
import { HOME_SECTIONS } from "../lib/content";
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const jobs = (z: string) => ((ballotFor(z)!.problems || []) as any[]).find((p) => p.id === "jobs");

describe("Civic audit26 fixes (Oct 30)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("1) 78701 turnout headline is exact, keeps the Travis County Clerk G24 source, never 'did not vote'", () => {
    const v = voteMatters("78701")!;
    expect(v.text).toBe("587,090 of 925,858 registered Travis County voters cast a ballot that was counted in Nov 2024 (63.4%).");
    expect(v.sources[0].url).toBe("https://votetravis.gov/wp-content/uploads/G24-Final-Reconciliation_Updated.pdf");
    expect(src("lib/voteMatters.mjs")).not.toMatch(/`[^`]*did not vote/);
  });
  it("2) ZIP unemployment is stored data with its MOE in Civic's format, linked to data.census.gov B23025", () => {
    expect(jobs("78701").value).toBe("1.4% (+/-0.8 points; small sample, unsure)");
    expect(jobs("78701").unsure).toBe(true);
    expect(jobs("10001").value).toBe("5.7% +/-1.3 points");
    expect(jobs("94103").value).toBe("7.2% +/-1.5 points");
    for (const z of ["78701", "94103", "10001"]) expect(jobs(z).source.url).toBe(`https://data.census.gov/table/ACSDT5Y2024.B23025?g=860XX00US${z}`);
    const raw = JSON.parse(src("data/civic/acs_b23025_censusreporter.json"));
    const e = raw.data["86000US78701"].B23025.estimate;
    expect(e.B23025003).toBe(8991); expect(e.B23025005).toBe(128);
    expect(src("lib/tools.ts")).not.toContain("CENSUS_API_KEY");
  });
  it("2) getLocalProblems leads with the county BLS LAUS rate; MOE values are never compared to a state figure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ Results: { series: [{ data: [{ value: "3.3", periodName: "September", year: "2026", footnotes: [{ code: "P" }] }] }] } }), { status: 200 })));
    const r: any = await getLocalProblems("78701");
    expect(r.problems[0]).toMatchObject({ id: "jobs-county", value: "3.3%", label: "Unemployment rate, Travis County (BLS LAUS, preliminary)" });
    expect(r.problems[0].source.url).toBe("https://data.bls.gov/timeseries/LAUCN484530000000003");
    const zipJobs = r.problems.find((p: any) => p.id === "jobs");
    expect(zipJobs.value).toBe("1.4% (+/-0.8 points; small sample, unsure)");
    expect(zipJobs.stateValue).toBeUndefined();
  });
  it("2) BLS down: the stored ZIP figure still shows, no county line invented", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const r: any = await getLocalProblems("10001");
    expect(r.problems.some((p: any) => p.id === "jobs-county")).toBe(false);
    expect(r.problems.find((p: any) => p.id === "jobs").value).toBe("5.7% +/-1.3 points");
  });
  it("3) Sources links point to record pages with Civic's wording", () => {
    const s = HOME_SECTIONS.find((x) => x.heading === "Sources")!.items!.join("\n");
    expect(s).toContain("[Ballotpedia](https://ballotpedia.org/Ballotpedia%27s_Candidate_Connection) (Candidate Connection survey answers and verbatim campaign text only)");
    expect(s).toContain("https://www.fec.gov/data/candidates/");
    expect(s).toContain("https://www.census.gov/programs-surveys/acs");
    expect(s).toContain("https://polymarket.com/elections");
    expect(s).not.toMatch(/\]\(https:\/\/(ballotpedia\.org|www\.fec\.gov|www\.census\.gov|polymarket\.com)\)/);
  });
});
