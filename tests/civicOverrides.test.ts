// With Civic's files present (a fixture standing in for lib/civicChecks.gen.json): a confirmed race reads "Listed in the
// order on the official sample ballot.", and the audit decides keep/drop for the Ballotpedia records it lists, on the site
// and in Towny alike.
import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/civicChecks.gen.json", () => ({
  default: {
    built: "fixture",
    orderFile: "fixture",
    auditFile: "fixture",
    ballotOrder: { byRace: { "us-senate-tx": { status: "confirmed", zip: "78701", url: null, order: null } } },
    stanceAudit: { records: [
      { candidate: "caitlin-rourk", issue: "infrastructure", quote: null, keep: true, label: "Audit chip", url: "https://example.org/rourk-citation" },
      { candidate: "skyler-a-korgel", issue: "taxes", quote: null, keep: false, label: null, url: null },
    ] },
  },
}));

const { answerFollowup, STATE_LAW_LINE, OFFER_COMPARE, ORDER_CONFIRMED_LINE, ORDER_UNSURE_LINE, overlapCountsFor } = await import("../lib/towny/followup");
const { verifyBallotRun } = await import("../lib/towny/verifyRun");
const { stancesFor, ISSUES } = await import("../lib/issues");
const { ballotFor } = await import("../lib/tools");
const { issuesFor } = await import("../lib/issueOrder");
const { overlapStatus } = await import("../lib/overlapCore.mjs");

const answers = Object.fromEntries(ISSUES.map((i) => [i.id, 5]));
const ask = (zip: string, question: string) => answerFollowup({ zip, question, answers }, { useModel: false, live: false });

describe("ballot_order_check.json present", () => {
  it("a confirmed race: 'Listed in the order on the official sample ballot.' with the office source", async () => {
    expect(ORDER_CONFIRMED_LINE).toBe("Listed in the order on the official sample ballot.");
    const r = await ask("78701", "Why is Talarico listed first in the Senate race?");
    expect(r.reply.split("\n")).toEqual([ORDER_CONFIRMED_LINE, STATE_LAW_LINE, "Source: Travis County Elections sample ballot [votetravis.gov]", OFFER_COMPARE]);
    expect(r.claims[0]).toMatchObject({ status: "confirmed", display: ORDER_CONFIRMED_LINE });
    expect(r.claims[0].source?.label).toBe("votetravis.gov");
    // other races are still unsure
    const g = await ask("78701", "Why is Abbott listed first for governor?");
    if (g.kind === "order") expect(g.reply.split("\n")[0]).toBe(ORDER_UNSURE_LINE);
  });
  it("the agent timeline marks only that race's order confirmed", () => {
    const v = verifyBallotRun("78701");
    expect(v.claims.find((c) => c.id === "us-senate-tx.order")?.status).toBe("confirmed");
    expect(v.claims.find((c) => c.id === "tx-gov.order")?.status).toBe("unsure");
  });
});

describe("ballotpedia_stance_audit.json present", () => {
  it("keep: counted, with the audit's chip and citation; drop: unsure, not counted", () => {
    expect(stancesFor("Caitlin Rourk").infrastructure.value).not.toBeNull();
    expect(stancesFor("Skyler A. Korgel").taxes).toMatchObject({ value: null, status: "unsure", unsureReason: "audit drop" });
  });
  it("Towny cites the audit's chip and still matches the site's counts", async () => {
    const r = await ask("78701", "What does Caitlin Rourk say about infrastructure?");
    expect(r.reply).toContain("[Audit chip]");
    for (const zip of ["78701", "94103", "10001"]) {
      const b = ballotFor(zip)!;
      const ids = issuesFor(zip, b.state).map((i) => i.id);
      for (const race of b.races) expect(overlapCountsFor(zip, race.id, answers)).toEqual(race.candidates.map((c) => { const o = overlapStatus(answers, stancesFor(c.name), ids); return { name: c.name, n: o.n, agree: o.agree }; }));
    }
  });
});
