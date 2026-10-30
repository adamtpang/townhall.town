import { describe, expect, it } from "vitest";
import { voteMatters } from "../lib/voteMatters.mjs";
describe("voteMatters", () => {
  it("SF: one sentence, Civic's denominator label, detail in sources", () => {
    const v = voteMatters("94103")!;
    expect(v.margin).toBe(216323);
    expect(v.stayedHome).toBe(204763);
    expect(v.text).toBe("216,323 votes decided Prop 32 in 2024; 204,763 adult citizens in SF (Census estimate) didn't vote.");
    expect(v.sources.map((s: { label: string }) => s.label)).toEqual(["Prop 32 results", "SF ballots cast", "Census ACS 2024"]);
    expect(v.sources.every((s: { url: string }) => /^https:\/\//.test(s.url))).toBe(true);
  });
  it("78701: registered non-voters from the one official reconciliation, no cross-source number", () => {
    const v = voteMatters("78701")!;
    expect(v.stayedHome).toBe(338768);
    expect(v.text).toBe("587,090 of 925,858 registered Travis County voters cast a ballot in Nov 2024; 338,768 registered voters didn't.");
    expect(JSON.stringify(v)).not.toMatch(/359,?292|eligible adults|censusreporter/);
    expect(v.sources[0].url).toBe("https://votetravis.gov/wp-content/uploads/G24-Final-Reconciliation_Updated.pdf");
    expect(JSON.stringify(v)).not.toContain("lagovista");
  });
  it("labels are 3 words or fewer and every link carries a full title", () => {
    for (const z of ["94103", "78701"]) for (const s of voteMatters(z)!.sources as { label: string; title: string }[]) {
      expect(s.label.split(/\s+/).length).toBeLessThanOrEqual(3);
      expect(s.title.length).toBeGreaterThan(s.label.length);
    }
  });
  it("no sourced numbers, nothing shown", () => {
    expect(voteMatters("10001")).toBeNull();
    expect(voteMatters("77002")).toBeNull();
  });
});
