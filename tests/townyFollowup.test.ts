// Item 4: Towny follow-ups (lib/towny/followup.ts, app/api/towny/followup). Offline: no model routing, no live fetches.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { answerFollowup, WHO_LINE, OUT_OF_SCOPE, cleanAnswers, OFFER_OTHERS, NOT_A_REC, STATE_LAW_LINE, OFFER_COMPARE, sfEarlyVoting, ORDER_UNSURE_LINE, ORDER_CONFIRMED_LINE } from "../lib/towny/followup";
import { NO_RECORD, UNSURE_NOTE } from "../lib/towny/verify";
import { OFFICES } from "../lib/towny/offices";
import { gateStance, isSlogan, CANDIDATE_CONNECTION } from "../lib/towny/stanceRules";
import { stancesFor } from "../lib/issues";
import { ISSUES } from "../lib/issues";
import { POST } from "../app/api/towny/followup/route";

const answers = Object.fromEntries(ISSUES.map((i, k) => [i.id, [5, -5, 2.5][k % 3]]));
const ask = (zip: string, question: string, extra: Record<string, unknown> = {}) => answerFollowup({ zip, question, answers, ...extra }, { useModel: false, live: false });
const BANNED = /\b(best|match(es)?|fits?|vote for|recommend(ed)?|should vote|strong|weak|extreme|radical)\b/i;

describe("fixed lines", () => {
  it("'who should I vote for' gets exactly the WHO line", async () => {
    expect(WHO_LINE).toBe("I don't pick for you. I can show where each candidate's sourced positions overlap with your answers.");
    for (const q of ["Who should I vote for?", "Who should I vote for for governor?", "Just tell me who is best.", "Who matches me?", "just tell me", "Which candidate should I pick?"]) {
      const r = await ask("78701", q);
      expect(r.reply, q).toBe(WHO_LINE);
      expect(r.kind).toBe("who");
    }
  });
  it("fix 1: out of scope names the three ZIPs and links vote.gov", async () => {
    expect(OUT_OF_SCOPE).toBe("Towny covers Austin (78701), San Francisco (94103) and New York City (10001) right now. For your ballot, check vote.gov.");
    const r = await ask("60601", "What about Prop A?");
    expect(r.reply).toBe(OUT_OF_SCOPE);
    expect(r.kind).toBe("out_of_scope");
    expect(r.links).toEqual([{ label: "vote.gov", url: "https://vote.gov" }]);
    expect((await ask("78701", "What's on the ballot in 77002?")).reply).toBe(OUT_OF_SCOPE);
    expect((await ask("94103", "What about Los Angeles?")).reply).toBe(OUT_OF_SCOPE);
  });
});

describe("tool answers, all through verify.ts", () => {
  it("Prop A in Austin and SF, Proposal 1 in NYC", async () => {
    const a = await ask("78701", "What about Prop A?");
    expect(a.kind).toBe("measure");
    expect(a.reply).toContain("City of Austin Proposition A");
    expect(a.report?.unsure).toBe(0);
    const s = await ask("94103", "what about prop a");
    expect(s.reply).toContain("SF Proposition A");
    const n = await ask("10001", "What about Proposal 1?");
    expect(n.reply).toContain("NYC Proposal 1");
    expect(n.reply).toContain(`Cost: ${NO_RECORD} Searched: nyc.gov.`); // cost is "unsure" in the data: no record, never filled in
    expect(n.reply).not.toContain("keeping community input"); // fix 7: not verbatim in the official abstract or CFB text
    // fix 8: every measure line ends with a period before its chip
    for (const l of a.reply.split("\n").filter((x) => / \[[^\]]+\]$/.test(x))) expect(l, l).toMatch(/[.!?]["”)]? \[[^\]]+\]$/);
    expect(a.reply).toMatch(/\(assumes a \$20,000 exemption\)\. \[/);
    for (const r of [a, s, n]) expect(r.reply).toContain("Towny doesn't say which way to vote on a measure.");
  });

  it("fixes 2 + 4: 'why first' returns only the order line, the state-law line, the office source and the offer", async () => {
    expect(STATE_LAW_LINE).toBe("Candidates appear in the order printed on the official sample ballot, which is set under state election law, not by Towny.");
    expect(ORDER_UNSURE_LINE).toBe("Ballot order: Unsure, we haven't confirmed it against the official sample ballot yet.");
    expect(ORDER_CONFIRMED_LINE).toBe("Listed in the order on the official sample ballot.");
    const TRAVIS = "https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf";
    const SF = "https://media.api.sf.gov/documents/N26_EN_VIP.pdf";
    // Civic's ballot_order_check (Oct 30): every 78701 race confirmed against Travis County's sample ballot; SF unsure
    // (source: SF Department of Elections, the VIP PDF); ny-12 isn't one of the six confirmed NYC contests.
    const cases: [string, string, Record<string, unknown>, boolean, string, { label: string; url: string }][] = [
      ["94103", "Why is she ranked first?", { focus: { raceId: "ca-11" } }, false, "Source: SF Department of Elections", { label: "SF Department of Elections", url: SF }],
      ["78701", "Why is Paxton listed first in the Senate race?", {}, true, "Source: Travis County Elections sample ballot [votetravis.gov]", { label: "votetravis.gov", url: TRAVIS }],
      ["10001", "Why is Lasher listed first?", {}, false, "Source: NYC Board of Elections sample ballot [vote.nyc]", { label: OFFICES["10001"].label, url: OFFICES["10001"].sampleBallot }],
    ];
    for (const [z, q, x, confirmed, src, link] of cases) {
      const r = await ask(z, q, x);
      expect(r.kind, q).toBe("order");
      const line = confirmed ? ORDER_CONFIRMED_LINE : ORDER_UNSURE_LINE;
      expect(r.reply.split("\n"), q).toEqual([line, STATE_LAW_LINE, src, OFFER_COMPARE]);
      expect(r.links, q).toEqual([link]);
      // never Ballotpedia, never "Sources differ", no stances or overlap for any single candidate
      expect(r.reply).not.toMatch(/ballotpedia|Sources differ|overlap with your answers| says \(|listed first because/i);
      expect(r.claims).toHaveLength(1);
      if (confirmed) { expect(r.claims[0]).toMatchObject({ status: "confirmed" }); expect(r.claims[0].source?.url).toBe(TRAVIS); }
      else { expect(r.claims[0]).toMatchObject({ status: "unsure", display: ORDER_UNSURE_LINE }); expect(r.claims[0].source).toBeUndefined(); }
      expect(r.reply).not.toMatch(/\b(she|her|he|his|him)\b/i); // never infers gender
    }
  });

  it("fix 2: a race list cites order to the office, not Ballotpedia", async () => {
    const r = await ask("78701", "Who is running for Senate?");
    expect(r.kind).toBe("candidates");
    expect(r.reply).not.toContain("in ballot order");
    // Official sample ballot order (Texas: REP, DEM, LIB): Paxton, Talarico, Brown.
    expect(r.reply).toMatch(/Ken Paxton[^\n]*\nJames Talarico[^\n]*\nTed Brown/);
    expect(r.reply).toContain(ORDER_CONFIRMED_LINE + "\n" + STATE_LAW_LINE + "\nSource: Travis County Elections sample ballot [votetravis.gov]");
    expect(r.claims.find((c) => c.id.endsWith(".order"))).toMatchObject({ status: "confirmed" });
    const sf = await ask("94103", "Who is running for Congress?");
    expect(sf.reply).toContain(ORDER_UNSURE_LINE + "\n" + STATE_LAW_LINE + "\nSource: SF Department of Elections");
  });

  it("fix 6: slogans are unsure and never counted, for everyone", async () => {
    expect(isSlogan("Micah Lasher believes few priorities are as urgent as the battle against climate change.")).toBe(true);
    expect(isSlogan("Invest in climate-resilient infrastructure and protect our waterfront and subway system.")).toBe(false);
    expect(isSlogan("Expand housing tax credits and increase funding and eligibility for rental assistance.")).toBe(false);
    const lasher = stancesFor("Micah C. Lasher");
    expect(gateStance(lasher.energy)).toEqual({ ok: false, reason: "slogan" });
    const r = await ask("10001", "How do the House candidates overlap with my answers?");
    expect(r.reply).toContain('Micah C. Lasher says (Energy and grid): "Micah Lasher believes few priorities are as urgent as the battle against climate change." (unsure)');
    const m = /Micah C\. Lasher: issue overlap with your answers: (\d+) of (\d+) issues\./.exec(r.reply);
    expect(m).not.toBeNull();
    expect(r.claims.find((c) => c.id === "micah-c-lasher.energy")).toMatchObject({ status: "unsure" });
    expect(r.claims.find((c) => c.id === "micah-c-lasher.energy")?.source).toBeUndefined();
  });

  it("fix 3: Ballotpedia stances are decided only by Civic's audit (keep_final), with its chip label and citation", () => {
    const bp = "https://ballotpedia.org/X";
    // Not in the audit: unsure (conservative).
    expect(gateStance({ quote: "Connie Chan supports Medicare for All which guarantees that every American has a right to health care", sourceUrl: bp })).toEqual({ ok: false, reason: "not audited" });
    // keep_final false, final_reason stale: unsure, never counted.
    const raw = JSON.parse(fs.readFileSync("data/stances.json", "utf8")).stances;
    expect(gateStance(raw["james-talarico"].wages, null, { candidate: "James Talarico", issueId: "wages", issueLabel: "Wages" })).toMatchObject({ ok: false, reason: "stale" });
    expect(stancesFor("James Talarico").wages).toMatchObject({ value: null, status: "unsure", unsureReason: "stale" });
    // keep_final true: counted, chip and URL from recommended_chip_label / recommended_citation_url.
    expect(stancesFor("Caitlin Rourk").infrastructure).toMatchObject({ value: 4, chip: "Ballotpedia Candidate Connection survey (2026)", chipUrl: "https://ballotpedia.org/Caitlin_Rourk#Campaign_themes" });
    expect(typeof CANDIDATE_CONNECTION).toBe("string");
    expect(gateStance({ quote: "Expand housing tax credits", sourceUrl: "https://micahlasher.com/issues" })).toMatchObject({ ok: true, via: "own" });
  });

  it("overlap for a whole race stays in ballot order", async () => {
    const r = await ask("10001", "How do the House candidates overlap with my answers?");
    expect(r.kind).toBe("overlap");
    const names = ["Micah C. Lasher", "Caroline Shinkle", "Wilneida Negron", "Karen Ortiz"];
    const idx = names.map((n) => r.reply.indexOf(`${n}: `));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
  });

  it("candidate positions are quotes with sources; same depth offer for the others", async () => {
    const r = await ask("78701", "What does Gina Hinojosa say about housing?");
    expect(r.kind).toBe("positions");
    expect(r.claims.every((c) => c.status === "confirmed" ? !!c.source : true)).toBe(true);
    expect(r.reply).toContain(OFFER_OTHERS);
  });

  it("neutral wording, never echoes the ZIP or answers in the reply or run log", async () => {
    const qs: [string, string, Record<string, unknown>?][] = [["78701", "What about Prop A?"], ["94103", "Why is she ranked first?", { focus: { raceId: "ca-11" } }], ["10001", "How do the House candidates overlap with my answers?"], ["78701", "What does Ted Brown say about housing?"], ["78701", "Why is Talarico listed first in the Senate race?"]];
    for (const [z, q, x] of qs) {
      const r = await ask(z, q, x);
      const fixedCopy = r.reply.split("\n").filter((l) => !l.includes('"')).join("\n"); // quotes are the candidate's own words
      expect(fixedCopy, q).not.toMatch(BANNED);
      expect(r.reply).not.toContain(z);
      expect(JSON.stringify(r.toolCalls)).not.toContain(z);
      expect(JSON.stringify(r.toolCalls)).not.toMatch(/answers|-5|2\.5/);
    }
  });

  it("#12: SF early voting cites the sf.gov page the dates come from; the fallback names the host that was tried", async () => {
    const TEXT = "Early voting at City Hall runs Oct 5 to Nov 2. Election Day is Tue, Nov 3, 7:00 AM-8:00 PM PT at City Hall and all polling places.";
    const URL_ = "https://www.sf.gov/november-3-2026-consolidated-general-election";
    const FALLBACK = "Couldn't reach sf.gov; showing saved data. Verify with the SF Department of Elections.";
    expect(sfEarlyVoting()).toMatchObject({ text: TEXT, source: { url: URL_, label: "SF Department of Elections" } });
    const ok = await ask("94103", "When does early voting end?");
    expect(ok.reply).toBe(`${TEXT} [SF Department of Elections]`);
    expect(ok.links).toContainEqual({ label: "SF Department of Elections", url: URL_ });
    // sf.gov answers: no fallback line, and the only URL tried is the cited one.
    const tried: string[] = [];
    const up = (async (u: string) => { tried.push(String(u)); return new Response("<html>November 3, 2026 Consolidated General Election</html>", { status: 200 }); }) as unknown as typeof fetch;
    const live = await answerFollowup({ zip: "94103", question: "When does early voting end?", answers }, { useModel: false, fetcher: up });
    expect(tried).toEqual([URL_]);
    expect(live.reply).toBe(`${TEXT} [SF Department of Elections]`);
    expect(live.report?.fallbacks).toEqual([]);
    // sf.gov down: one retry, then the visible fallback naming sf.gov.
    let n = 0;
    const down = (async () => { n++; throw new Error("down"); }) as unknown as typeof fetch;
    const r = await answerFollowup({ zip: "94103", question: "When does early voting end?", answers }, { useModel: false, fetcher: down });
    expect(n).toBe(2);
    expect(r.reply).toBe(`${TEXT} [SF Department of Elections]\n${FALLBACK}`);
    expect(r.report?.fallbacks).toEqual([FALLBACK]);
  });

  it("cleans answers: only known issues, clamped", () => {
    expect(cleanAnswers({ housing: 9, evil: 5, taxes: "x" })).toEqual({ housing: 5, taxes: null });
  });
});

describe("route", () => {
  it("POST answers, no-store; bad input 400; out of scope fixed", async () => {
    const post = (b: unknown) => POST(new Request("http://x/api/towny/followup", { method: "POST", body: JSON.stringify(b), headers: { "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` } }));
    const ok = await post({ zip: "78701", question: "Who should I vote for?" });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect((await ok.json()).reply).toBe(WHO_LINE);
    expect((await post({ zip: "78701" })).status).toBe(400);
    expect((await (await post({ zip: "30301", question: "hi" })).json()).reply).toBe(OUT_OF_SCOPE);
  });
  it("route never logs input; new files have no 11-12px text", () => {
    for (const f of ["app/api/towny/followup/route.ts", "lib/towny/followup.ts", "lib/towny/verify.ts", "lib/towny/verifyRun.ts"]) {
      const s = fs.readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/console\.(log|info|warn|error)/);
      expect(s, f).not.toMatch(/text-xs|text-\[(10|11|12)px\]/);
    }
  });
});
