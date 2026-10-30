// QA P1 (3:47 PM): every ACS figure shows its stored MOE; with no stored MOE it is marked unsure, never invented.
import { describe, it, expect } from "vitest";
import { withAcsMoe, reasonWithAcsMoe, NO_MOE_NOTE } from "../lib/acsMoe";
import { ballotFor, getLocalProblems } from "../lib/tools";
import { issuesFor } from "../lib/issueOrder";

describe("ACS margins of error", () => {
  it("keeps the stored B23025 MOE and marks B25070/B27010 unsure for every scoped ZIP", async () => {
    for (const zip of ["78701", "94103", "10001"]) {
      const ps = ballotFor(zip)!.problems as any[];
      expect(ps.length).toBeGreaterThan(0);
      for (const p of ps) {
        const shown = `${p.label} ${p.value}`;
        expect(/\+\/-/.test(shown) || shown.includes(NO_MOE_NOTE)).toBe(true);
        if (p.table === "B23025") expect(String(p.value)).toMatch(/\+\/-\d/);
        if (p.table === "B25070" || p.table === "B27010") { expect(p.label).toContain(`(${NO_MOE_NOTE})`); expect(String(p.value)).not.toMatch(/\+\/-|±/); }
      }
      const lp = await getLocalProblems(zip);
      for (const p of lp.problems as any[]) if (p.id !== "jobs-county") expect(`${p.label} ${p.value}`).toMatch(/\+\/-|unsure/);
    }
  });
  it("never adds a number, only the note; idempotent; non-ACS untouched", () => {
    const p = { label: "Renters paying 30%+ of income on rent", value: "53.8%", unit: "%", table: "B25070" };
    const q = withAcsMoe(p);
    expect(q.value).toBe("53.8%");
    expect(q.label).toBe(`Renters paying 30%+ of income on rent (${NO_MOE_NOTE})`);
    expect(withAcsMoe(q)).toEqual(q);
    const bls = { label: "Unemployment rate, Travis County (BLS LAUS)", value: "3.1%", unit: "%", source: { label: "BLS LAUS", url: "https://bls.gov" } };
    expect(withAcsMoe(bls)).toBe(bls);
  });
  it("issue reasons citing ACS ZCTA figures get the note", () => {
    expect(reasonWithAcsMoe("5.1% of 78701 residents have no health insurance (ACS 2024 5-year (2020-2024), ZCTA level, via Census Reporter).")).toBe(`5.1% of 78701 residents have no health insurance (ACS 2024 5-year (2020-2024), ZCTA level, via Census Reporter; ${NO_MOE_NOTE}).`);
    for (const [zip, st] of [["78701", "TX"], ["94103", "CA"], ["10001", "NY"]] as const) for (const i of issuesFor(zip, st) as any[]) if (i.reason && /ACS/.test(i.reason)) expect(i.reason).toContain(NO_MOE_NOTE);
  });
});
