// Civic, Oct 30 1:54 PM CT: loaders for ballot_order_check.json and civic/bp22/ballotpedia_stance_audit.json (both may be
// missing), the ballot-order line, and one shared stance-eligibility rule for the site and Towny.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseOrderCheck, parseStanceAudit } from "../lib/civicChecks.mjs";
import gen from "../lib/civicChecks.gen.json";
import { orderCheckFor, ORDER_UNCHECKED, ORDER_MISMATCH } from "../lib/towny/ballotOrder";
import { stanceEligibility, auditFor, type AuditRecord } from "../lib/stanceEligibility";
import { stancesFor, ISSUES } from "../lib/issues";
import { ballotFor } from "../lib/tools";
import { issuesFor } from "../lib/issueOrder";
import { overlapStatus } from "../lib/overlapCore.mjs";
import { overlapCountsFor } from "../lib/towny/followup";
import { verifyBallotRun } from "../lib/towny/verifyRun";

const BP = "https://ballotpedia.org/Someone";

describe("loaders tolerate missing or odd files", () => {
  it("missing files: empty results, current behavior", () => {
    for (const raw of [null, undefined, 3, "x", [], {}]) {
      expect(parseOrderCheck(raw)).toEqual({ byRace: {} });
      expect(parseStanceAudit(raw)).toEqual({ records: [] });
    }
    // Civic's files are in place (Oct 30): 103 races in the order check, 91 Ballotpedia records in the audit (75 kept, 16 stale).
    const g = gen as unknown as { ballotOrder: { byRace: Record<string, { status: string; zip: string | null }> }; stanceAudit: { records: { keep: boolean; reason?: string | null }[] } };
    const by = Object.values(g.ballotOrder.byRace);
    expect(by).toHaveLength(103);
    const n = (zip: string, status: string) => by.filter((c) => c.zip === zip && c.status === status).length;
    expect([n("78701", "confirmed"), n("10001", "confirmed"), n("10001", "unconfirmed"), n("94103", "unconfirmed"), n("94103", "single")]).toEqual([58, 6, 7, 19, 13]);
    expect(g.stanceAudit.records).toHaveLength(91);
    expect(g.stanceAudit.records.filter((r) => r.keep)).toHaveLength(75);
    const stale = g.stanceAudit.records.filter((r) => !r.keep);
    expect(stale).toHaveLength(16);
    for (const r of stale) expect(r.reason).toMatch(/^stale/i);
  });
  it("build script writes empty sections when the files don't exist", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "civic-"));
    const before = fs.readFileSync("lib/civicChecks.gen.json", "utf8");
    try {
      const out = execFileSync("node", ["scripts/build-civic-checks.mjs", "--order", path.join(d, "nope.json"), "--audit", path.join(d, "nope2.json")], { encoding: "utf8" });
      expect(out).toMatch(/ballot order: missing \(0 races\); audit: missing \(0 records\)/);
      expect(JSON.parse(fs.readFileSync("lib/civicChecks.gen.json", "utf8"))).toMatchObject({ ballotOrder: { byRace: {} }, stanceAudit: { records: [] } });
    } finally { fs.writeFileSync("lib/civicChecks.gen.json", before); }
  });
  it("ballot_order_check.json: list, {races}, or keyed by race id; only an explicit confirmation counts", () => {
    const a = parseOrderCheck([{ raceId: "us-senate-tx", status: "confirmed", zip: "78701", order: ["A", "B"] }, { raceId: "tx-gov", status: "pending" }, { status: "confirmed" }]);
    expect(a.byRace["us-senate-tx"]).toEqual({ status: "confirmed", zip: "78701", url: null, order: ["A", "B"] });
    expect(a.byRace["tx-gov"].status).toBe("unconfirmed");
    expect(Object.keys(a.byRace)).toHaveLength(2);
    expect(parseOrderCheck({ races: [{ race_id: "ca-11", confirmed: true, url: "https://sfelections.org/x" }] }).byRace["ca-11"]).toMatchObject({ status: "confirmed", url: "https://sfelections.org/x" });
    expect(parseOrderCheck({ "ny-12": { result: "match" }, "ny-10": { result: "maybe" } }).byRace).toMatchObject({ "ny-12": { status: "confirmed" }, "ny-10": { status: "unconfirmed" } });
    expect(parseOrderCheck({ races: [{ race: "ca-11", status: "confirmed", url: "not a url" }] }).byRace["ca-11"].url).toBeNull();
  });
  it("Civic's audit shape: keep_final, final_reason, recommended_chip_label, recommended_citation_url (a bare keep flag is ignored)", () => {
    const { records } = parseStanceAudit([
      { candidate: "Bo French", race_id: "tx-rrc", issue: "energy", quote: "Q one.", keep: false, keep_final: true, final_reason: "keep: campaign site", recommended_chip_label: "Campaign website", recommended_citation_url: "https://ballotpedia.org/Bo_French#Campaign_themes" },
      { candidate: "Ted Brown", issue: "taxes", quote: "Q two.", keep: true, keep_final: false, final_reason: "stale: 2020 race" },
      { candidate: "Nobody", issue: "taxes", keep: true },
    ]);
    expect(records).toEqual([
      { candidate: "bo-french", issue: "energy", quote: "q one", keep: true, label: "Campaign website", url: "https://ballotpedia.org/Bo_French#Campaign_themes", reason: "keep: campaign site", race: "tx-rrc" },
      { candidate: "ted-brown", issue: "taxes", quote: "q two", keep: false, label: null, url: null, reason: "stale: 2020 race", race: null },
    ]);
  });
  it("ballotpedia_stance_audit.json: keep/drop, chip label, citation; unclear decisions are ignored", () => {
    const { records } = parseStanceAudit({ records: [
      { candidate: "Caitlin Rourk", issue: "infrastructure", decision: "keep", chipLabel: "Campaign site", citation: "https://example.org/rourk" },
      { candidateId: "skyler-a-korgel", issueId: "taxes", decision: "DROP" },
      { quote: "Some exact quote.", keep: false },
      { candidate: "X", issue: "taxes", decision: "needs review" },
      { candidate: "Y", decision: "keep" },
      { candidate: "Z", issue: "wages", verdict: "keep", citation: { url: "https://example.org/z", label: "Z site" } },
    ] });
    expect(records).toEqual([
      { candidate: "caitlin-rourk", issue: "infrastructure", quote: null, keep: true, label: "Campaign site", url: "https://example.org/rourk", reason: null, race: null },
      { candidate: "skyler-a-korgel", issue: "taxes", quote: null, keep: false, label: null, url: null, reason: null, race: null },
      { candidate: "z", issue: "wages", quote: null, keep: true, label: "Z site", url: "https://example.org/z", reason: null, race: null },
    ]);
    expect(parseStanceAudit([{ name: "A B", issue: "Water and infrastructure", action: "keep" }]).records[0]).toMatchObject({ candidate: "a-b", issue: "water and infrastructure", keep: true });
  });
});

describe("ballot order check", () => {
  const race = { id: "us-senate-tx", candidates: [{ name: "Ken Paxton" }, { name: "James Talarico" }] } as never;
  it("unsure unless Civic marked the race confirmed for this ZIP and any listed order is ours", () => {
    expect(orderCheckFor("78701", race, {})).toMatchObject({ confirmed: false, reason: ORDER_UNCHECKED });
    expect(orderCheckFor("78701", race, { "us-senate-tx": { status: "unconfirmed", zip: null, url: null, order: null } })).toMatchObject({ confirmed: false, reason: ORDER_UNCHECKED });
    expect(orderCheckFor("78701", race, { "us-senate-tx": { status: "confirmed", zip: null, url: null, order: null } })).toMatchObject({ confirmed: true, url: "https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf" });
    expect(orderCheckFor("78701", race, { "us-senate-tx": { status: "confirmed", zip: "94103", url: null, order: null } }).confirmed).toBe(false);
    expect(orderCheckFor("78701", race, { "us-senate-tx": { status: "confirmed", zip: "78701", url: null, order: ["James Talarico", "Ken Paxton"] } })).toMatchObject({ confirmed: false, reason: ORDER_MISMATCH });
    expect(orderCheckFor("78701", race, { "us-senate-tx": { status: "confirmed", zip: "78701", url: null, order: ["ken paxton", "James Talarico"] } }).confirmed).toBe(true);
  });
  it("agent timeline: order claims are confirmed only for races Civic confirmed (78701 all 58, 10001 six), unsure elsewhere", () => {
    const want: Record<string, number> = { "78701": 58, "94103": 0, "10001": 6 };
    for (const z of ["78701", "94103", "10001"]) {
      const v = verifyBallotRun(z);
      const order = v.claims.filter((x) => x.id.endsWith(".order") && x.status !== "no_record");
      const conf = order.filter((c) => c.status === "confirmed").map((c) => c.id.replace(/\.order$/, ""));
      expect(conf.length, z).toBe(want[z]);
      for (const c of order) if (c.status !== "confirmed") expect(c.status, c.id).toBe("unsure");
    }
  });
});

describe("one stance-eligibility rule", () => {
  const audit: AuditRecord[] = [
    { candidate: "someone", issue: "taxes", quote: null, keep: true, label: "Campaign site", url: "https://example.org/c" },
    { candidate: "someone", issue: "wages", quote: null, keep: false, label: null, url: null },
  ];
  it("without an audit record: a Ballotpedia stance is unsure (not audited); the narrow slogan rule", () => {
    expect(stanceEligibility({ quote: "Someone supports a thing.", sourceUrl: BP }, null, {}, [])).toEqual({ ok: false, reason: "not audited" });
    expect(stanceEligibility({ quote: "Few priorities are as urgent as the battle against climate change.", sourceUrl: "https://x.org" }, null, {}, [])).toEqual({ ok: false, reason: "slogan" });
    expect(stanceEligibility({ quote: "Expand housing tax credits", sourceUrl: "https://x.org/i" }, null, {}, [])).toMatchObject({ ok: true, via: "own" });
  });
  it("the audit overrides keep/drop for the Ballotpedia records it lists, never the slogan rule or non-Ballotpedia sources", () => {
    expect(stanceEligibility({ quote: "Someone supports a thing.", sourceUrl: BP }, null, { candidate: "Someone", issueId: "taxes" }, audit)).toEqual({ ok: true, url: "https://example.org/c", label: "Campaign site", via: "audit" });
    expect(stanceEligibility({ quote: "Someone supports a thing.", sourceUrl: BP }, null, { candidate: "Someone", issueId: "wages" }, audit)).toEqual({ ok: false, reason: "audit drop" });
    expect(stanceEligibility({ quote: "Old line.", sourceUrl: BP }, null, { candidate: "Someone", issueId: "wages" }, [{ ...audit[1], reason: "stale: 2020 race" }])).toEqual({ ok: false, reason: "stale", detail: "stale: 2020 race" });
    expect(stanceEligibility({ quote: "Few priorities are as urgent as taxes.", sourceUrl: BP }, null, { candidate: "Someone", issueId: "taxes" }, audit)).toEqual({ ok: false, reason: "slogan" });
    expect(stanceEligibility({ quote: "Cut taxes.", sourceUrl: "https://someone.com" }, null, { candidate: "Someone", issueId: "wages" }, audit)).toMatchObject({ ok: true, via: "own" });
    expect(auditFor({ quote: "x" }, { candidate: "Someone", issueLabel: "Taxes" }, audit)?.keep).toBe(true);
    expect(auditFor({ quote: "x" }, { candidate: "Other", issueId: "taxes" }, audit)).toBeNull();
  });
  it("an audit 'keep' with no chip label or citation falls back to the curated URL and its host", () => {
    const ok = stanceEligibility({ quote: "I led the campaign that won a higher minimum wage and paid sick days for 200,000 workers", sourceUrl: BP }, null, { candidate: "Someone", issueId: "x" }, [{ candidate: "someone", issue: "x", quote: null, keep: true, label: null, url: null }]);
    expect(ok).toEqual({ ok: true, url: BP, label: "ballotpedia.org", via: "audit" });
  });
  it("stancesFor applies it: ineligible stances are unsure (quote kept for display, value null, never counted)", () => {
    const s = stancesFor("Ted Brown"); // four stale records in Civic's audit
    const bp = Object.values(s).filter((x) => x.unsureReason);
    expect(bp.length).toBeGreaterThan(0);
    for (const x of bp) { expect(x.value).toBeNull(); expect(x.status).toBe("unsure"); expect(x.quote).toBeTruthy(); }
  });
});

describe("NYC Proposal 1 with today's data", () => {
  it("both CFB sentences are in the data, so they replace our curated yes/no lines", async () => {
    const { answerFollowup, CFB_GUIDE } = await import("../lib/towny/followup");
    const r = await answerFollowup({ zip: "10001", question: "What is Proposal 1?", answers: {} }, { useModel: false, live: false });
    expect(r.reply).toContain(`${CFB_GUIDE}: "A "yes" vote speeds up process to use public space while maintaining community input." [nycvotes.org]`);
    expect(r.reply).not.toContain("A yes vote: Speeds up the process to use public space.");
    expect(r.reply).not.toContain("A no vote: Keeps the longer process");
  });
});

describe("site overlap = Towny overlap (P1)", () => {
  const sets = [
    Object.fromEntries(ISSUES.map((i, k) => [i.id, [5, -5, 2.5][k % 3]])),
    Object.fromEntries(ISSUES.map((i) => [i.id, 5])),
    Object.fromEntries(ISSUES.map((i, k) => [i.id, k % 2 ? -5 : null])),
  ];
  it("counts match for every race on all 3 ZIPs", () => {
    let races = 0;
    for (const zip of ["78701", "94103", "10001"]) {
      const b = ballotFor(zip)!;
      const ids = issuesFor(zip, b.state).map((i) => i.id);
      for (const r of b.races) {
        races++;
        for (const answers of sets) {
          const site = r.candidates.map((c) => { const o = overlapStatus(answers, stancesFor(c.name), ids); return { name: c.name, n: o.n, agree: o.agree }; });
          expect(overlapCountsFor(zip, r.id, answers), `${zip} ${r.id}`).toEqual(site);
        }
      }
    }
    expect(races).toBeGreaterThan(30);
  });
});
