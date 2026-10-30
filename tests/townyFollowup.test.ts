// Item 4: Towny follow-ups (lib/towny/followup.ts, app/api/towny/followup). Offline: no model routing, no live fetches.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { answerFollowup, WHO_LINE, OUT_OF_SCOPE, cleanAnswers, OFFER_OTHERS, NOT_A_REC } from "../lib/towny/followup";
import { NO_RECORD } from "../lib/towny/verify";
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
  it("out of scope gets 'Austin, SF and NYC for now.'", async () => {
    expect(OUT_OF_SCOPE).toBe("Austin, SF and NYC for now.");
    expect((await ask("60601", "What about Prop A?")).reply).toBe(OUT_OF_SCOPE);
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
    expect(n.reply).toContain(`${NO_RECORD} Searched: nyc.gov.`); // cost is "unsure" in the data: no record, never filled in
    for (const r of [a, s, n]) expect(r.reply).toContain("Towny doesn't say which way to vote on a measure.");
  });

  it("'why is she ranked first' explains ballot order + overlap, by name, no recommendation", async () => {
    const r = await ask("94103", "Why is she ranked first?", { focus: { raceId: "ca-11" } });
    expect(r.kind).toBe("order");
    expect(r.reply).toContain("Connie Chan is listed first because that is the order on the ballot.");
    expect(r.reply).toMatch(/Connie Chan: issue overlap with your answers: \d+ of \d+ issues\./);
    expect(r.reply).toContain(NOT_A_REC);
    expect(r.reply).toContain(OFFER_OTHERS);
    expect(r.reply).not.toMatch(/\b(she|her|he|his|him)\b/i); // never infers gender
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

  it("a source outage is retried once, then shown", async () => {
    let n = 0;
    const down = (async () => { n++; throw new Error("down"); }) as unknown as typeof fetch;
    const r = await answerFollowup({ zip: "94103", question: "When does early voting end?", answers }, { useModel: false, fetcher: down });
    expect(n).toBe(2);
    expect(r.reply).toContain("Couldn't reach sf.gov, used curated data.");
    expect(r.report?.fallbacks).toEqual(["Couldn't reach sf.gov, used curated data"]);
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
