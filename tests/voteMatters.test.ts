import { describe, expect, it } from "vitest";
import { voteMatters } from "../lib/voteMatters.mjs";
describe("voteMatters", () => {
  it("SF: one sentence, Civic's denominator label, detail in sources", () => {
    const v = voteMatters("94103")!;
    expect(v.margin).toBe(216323);
    expect(v.stayedHome).toBe(204763);
    expect(v.text).toBe("216,323 votes decided Prop 32 in 2024. 204,763 adult citizens in SF (Census estimate) didn't vote.");
    expect(v.sources.every((s: { url: string }) => /^https:\/\//.test(s.url))).toBe(true);
  });
  it("78701: official Travis County totals (G24 reconciliation), Census denominator", () => {
    const v = voteMatters("78701")!;
    expect(v.stayedHome).toBe(359292);
    expect(v.text).toContain("587,090 of 925,858 registered Travis County voters");
    expect(v.sources[0].url).toBe("https://votetravis.gov/wp-content/uploads/G24-Final-Reconciliation_Updated.pdf");
    expect(JSON.stringify(v)).not.toContain("lagovista");
  });
  it("no sourced numbers, nothing shown", () => {
    expect(voteMatters("10001")).toBeNull();
    expect(voteMatters("77002")).toBeNull();
  });
});
