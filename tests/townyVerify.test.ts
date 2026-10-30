// Item 3 of "Towny is a 10/10 agent": self-check (lib/towny/verify.ts) and the VerifyStep component.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { verifyClaims, withRetry, invalidFor, renderVerified, UNSURE_NOTE, NO_RECORD, NO_POSITION, NO_VOTE, searchedLine, differsLine, type Claim, type Source } from "../lib/towny/verify";
import { verifyBallotRun } from "../lib/towny/verifyRun";
import VerifyStep, { UNSURE_EXPLAINER, verifyFinding, verifyTitle } from "../components/VerifyStep";

const cur = (text: string, url = "https://www.votetravis.gov/x", subject?: string): Source => ({ url, label: new URL(url).hostname, origin: "curated", text, subject });
const live = (text: string, url: string, values?: Record<string, string>): Source => ({ url, label: new URL(url).hostname, origin: "live", text, fetchedInRun: true, values });

describe("verifyClaims (pure)", () => {
  it("keeps Civic's exact strings", () => {
    expect(UNSURE_NOTE).toBe("Unsure: we couldn't confirm this in a cited source.");
    expect(NO_RECORD).toBe("No record found.");
    expect(NO_POSITION).toBe("No public position found yet.");
    expect(NO_VOTE).toBe("No voting record found.");
    expect(searchedLine(["votetravis.gov", "sos.state.tx.us"])).toBe("Searched: votetravis.gov, sos.state.tx.us.");
    expect(differsLine("Travis County Elections")).toBe("Sources differ; verify with Travis County Elections.");
  });

  it("confirms only when a source states the value (same topic isn't enough)", () => {
    const claims: Claim[] = [
      { id: "a", field: "measure", text: "Cost: $260,000,000 in bonds", value: "$260,000,000 in bonds" },
      { id: "b", field: "measure", text: "Cost: $300,000,000 in bonds", value: "$300,000,000 in bonds" },
    ];
    const v = verifyClaims({ claims, sources: [cur("Proposition A authorizes $260,000,000 in bonds for parks.")] });
    expect(v.claims[0].status).toBe("confirmed");
    expect(v.claims[0].source?.url).toContain("votetravis.gov");
    expect(v.claims[1].status).toBe("unsure");
    expect(v.claims[1].display).toBe("Cost: $300,000,000 in bonds (unsure)");
    expect(v.claims[1].note).toBe(UNSURE_NOTE);
    expect(v.claims[1].source).toBeUndefined(); // unsure never gets a source chip
    expect(v.report.summary).toBe("Checked 2 claims, 1 marked unsure");
    expect(v.report.unverified.map((u) => u.id)).toEqual(["b"]);
  });

  it("empty lookups become no-record lines, never filled in", () => {
    const v = verifyClaims({ claims: [
      { id: "s", field: "stance", text: "x", value: null, subject: "Pat Q" },
      { id: "v", field: "vote", text: "x", value: "" },
      { id: "c", field: "measure", text: "Cost: unsure", value: "unsure", searched: ["nyc.gov"] },
    ], sources: [] });
    expect(v.claims.map((c) => c.display)).toEqual([NO_POSITION, NO_VOTE, NO_RECORD]);
    expect(v.claims[2].note).toBe("Searched: nyc.gov.");
    expect(v.report.noRecord).toBe(3);
  });

  it("a candidate's quote must come from a source that names them or is their own record", () => {
    const c: Claim = { id: "q", field: "stance", text: 'A B says: "build more homes"', value: "build more homes", subject: "A B" };
    expect(verifyClaims({ claims: [c], sources: [cur("We will build more homes", "https://ab.example/", "A B")] }).claims[0].status).toBe("confirmed");
    expect(verifyClaims({ claims: [c], sources: [cur("C D: we will build more homes", "https://cd.example/", "C D")] }).claims[0].status).toBe("unsure");
  });

  it("live sources count only when fetched this run and valid for the field", () => {
    const c: Claim = { id: "d", field: "logistics", text: "Early voting ends Oct 30.", value: "Oct 30" };
    expect(verifyClaims({ claims: [c], sources: [live("Early voting ends Oct 30", "https://www.votetravis.gov/early")] }).claims[0].status).toBe("confirmed");
    expect(verifyClaims({ claims: [c], sources: [live("Early voting ends Oct 30", "https://www.kut.org/story")] }).claims[0].status).toBe("unsure");
    expect(verifyClaims({ claims: [c], sources: [{ ...live("Early voting ends Oct 30", "https://www.votetravis.gov/early"), fetchedInRun: false }] }).claims[0].status).toBe("unsure");
    expect(invalidFor("stance", "https://en.wikipedia.org/wiki/X")).toBeTruthy();
    expect(invalidFor("money", "https://www.fec.gov/data/candidate/H0")).toBeNull();
  });

  it("curated beats live; a valid live source that disagrees gives 'Sources differ'", () => {
    const c: Claim = { id: "c", field: "measure", text: "Cost: $260,000,000", value: "$260,000,000", key: "austin-prop-a.cost", office: "Travis County Elections (votetravis.gov)" };
    const v = verifyClaims({ claims: [c], sources: [cur("$260,000,000"), live("$270,000,000", "https://www.austintexas.gov/bond", { "austin-prop-a.cost": "$270,000,000" })] });
    expect(v.claims[0].status).toBe("differs");
    expect(v.claims[0].note).toBe("Sources differ; verify with Travis County Elections (votetravis.gov).");
    expect(v.claims[0].source?.origin).toBe("curated");
  });

  it("onFail drop removes the sentence and reports it", () => {
    const v = verifyClaims({ claims: [{ id: "z", field: "bio", text: "Served 12 years.", value: "12 years", onFail: "drop" }], sources: [] });
    expect(v.claims[0].status).toBe("dropped");
    expect(renderVerified(v.claims)).toBe("");
    expect(v.report.dropped).toBe(1);
    expect(v.report.unverified[0].text).toBe("Served 12 years.");
  });

  it("is pure: same input, same output", () => {
    const input = { claims: [{ id: "a", field: "race" as const, text: "t", value: "Governor" }], sources: [cur("Governor of Texas")] };
    expect(verifyClaims(input)).toEqual(verifyClaims(input));
  });
});

describe("withRetry: retry once, then visible fallback", () => {
  it("succeeds on the second try", async () => {
    let n = 0;
    const r = await withRetry("fetchSource", "votetravis.gov", async () => { if (++n === 1) throw new Error("x"); return "ok"; }, () => "curated");
    expect(r).toEqual({ value: "ok", run: { tool: "fetchSource", ok: true, attempts: 2, fallback: null } });
  });
  it("falls back after two failures and says so", async () => {
    const r = await withRetry("fetchSource", "votetravis.gov", async () => { throw new Error("down"); }, () => "curated");
    expect(r.value).toBe("curated");
    expect(r.run.fallback).toBe("Couldn't reach votetravis.gov; showing saved data.");
    const o = await withRetry("fetchSource", "votetravis.gov", async () => { throw new Error("down"); }, () => "curated", "Travis County Elections");
    expect(o.run.fallback).toBe("Couldn't reach votetravis.gov; showing saved data. Verify with Travis County Elections.");
    const v = verifyClaims({ claims: [], sources: [], toolRuns: [o.run] });
    expect(v.report.fallbacks).toEqual(["Couldn't reach votetravis.gov; showing saved data. Verify with Travis County Elections."]);
  });
});

describe("verifyBallotRun (standalone interface for the agent timeline)", () => {
  it("checks every race on all 3 ballots; ballot order stays unsure until checked against the office's sample ballot", () => {
    for (const z of ["78701", "94103", "10001"]) {
      const v = verifyBallotRun(z);
      expect(v.report.checked).toBeGreaterThan(10);
      const order = v.claims.filter((c) => c.id.endsWith(".order") && c.status !== "no_record");
      expect(order.length, z).toBeGreaterThan(0);
      expect(order.every((c) => c.status === "unsure" && !c.source), z).toBe(true); // never cited to Ballotpedia
      expect(v.report.unsure, z).toBe(order.length); // everything else is confirmed by curated data
      expect(v.claims.every((c) => c.status !== "confirmed" || c.source)).toBe(true);
    }
  });
  it("narration the sources don't state comes back unsure", () => {
    const v = verifyBallotRun("78701", { raceIds: ["us-senate-tx"], measureIds: [], narration: [{ id: "n1", field: "stance", text: "Ted Brown wants a flat tax.", value: "flat tax", subject: "Ted Brown" }] });
    expect(v.claims.find((c) => c.id === "n1")?.status).toBe("unsure");
    expect(v.report.summary).toBe("Checked 2 claims, 2 marked unsure"); // the order claim (unchecked) + the narration
  });
});

describe("VerifyStep", () => {
  const v = verifyBallotRun("10001", { raceIds: ["ny-12"], measureIds: ["nyc-prop-1"], narration: [{ id: "n1", field: "stance", text: "Made-up line.", value: "made up" }, { id: "n2", field: "vote", text: "x", value: null }] });
  const html = renderToStaticMarkup(h(VerifyStep, { report: v.report, claims: v.claims }));
  it("renders title, badge, finding and the unsure line", () => {
    expect(html).toContain(verifyTitle(v.report.checked));
    expect(verifyTitle(5)).toBe("Checked 5 claims against sources");
    expect(html).toContain("Self-check");
    expect(verifyFinding({ confirmed: 4, unsure: 2, noRecord: 1 })).toBe("4 confirmed · 2 unsure · 1 no record");
    expect(html).toContain("tabular-nums");
    expect(html).toContain(UNSURE_EXPLAINER.replace("'", "&#x27;"));
    expect(html).toContain("Unsure");
    expect(html).toContain("decoration-dashed");
    expect(html).toContain(NO_VOTE);
  });
  it("follows Design's rules: 14px minimum, radius 0, 44px targets, ink or primary only", () => {
    const src = fs.readFileSync("components/VerifyStep.tsx", "utf8");
    expect(src).not.toMatch(/text-xs|text-\[(10|11|12)px\]/);
    expect(src).not.toMatch(/rounded-(sm|md|lg|xl|full)|\brounded\b(?!-none)/);
    expect(src).not.toMatch(/\b(red|amber|green|emerald|yellow|orange|rose)-\d/);
    for (const b of html.match(/<button[^>]*>/g) ?? []) expect(b).toContain("min-h-[44px]");
    expect(src).toContain("min-h-[44px]");
    expect(src).toMatch(/opacity-40/); // flash is opacity only
  });
});
