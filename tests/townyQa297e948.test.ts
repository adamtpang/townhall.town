// QA early look at 297e948 (Adam, Oct 30 2026 3:54 PM CT): P1 copy and P2 link label, on /api/interview and /api/towny-test.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { ORDER_CONFIRMED_HEAD, ORDER_UNSURE, SPLIT_LINE, orderConfirmedScoped } from "../lib/ballotOrder";
import { guardReply } from "../lib/towny/orderGuard";

const Q = "What order are candidates on my ballot?";
const OLD_OPENER = "The races are not listed in the order they appear on the ballot.";
const OLD_HEAD = "That is the order of the candidates within each of these races";
const SF_EV = "https://www.sf.gov/november-3-2026-consolidated-general-election";

type J = { reply: string; links?: { label: string; url: string }[]; handledBy?: string };
let interview: (zip: string, text: string) => Promise<J>;
let townyTest: (zip: string, message: string) => Promise<J>;
const run = vi.fn();
let ip = 70;
beforeAll(async () => {
  vi.resetModules();
  vi.doMock("../lib/townyRun", () => ({ runTowny: run }));
  const i = await import("../app/api/interview/route");
  const t = await import("../app/api/towny-test/route");
  interview = async (zip, text) => (await i.POST(new Request("https://x/api/interview", { method: "POST", body: JSON.stringify({ zip, messages: [{ text }] }), headers: { "x-forwarded-for": `198.51.100.${ip++}`, "content-type": "application/json" } }))).json();
  townyTest = async (zip, message) => (await t.POST(new Request("https://x/api/towny-test", { method: "POST", body: JSON.stringify({ zip, message }) }))).json();
});

describe("P1: confirmed ZIPs get QA's one line instead of the contradictory pair", () => {
  it("QA's exact wording", () => {
    expect(ORDER_CONFIRMED_HEAD).toBe("Races are not in ballot order. Within each race, candidates are listed in the order on the official sample ballot.");
  });
  it("78701 and 10001 on both endpoints; groups, Unsure lines and split groups kept", async () => {
    for (const z of ["78701", "10001"]) for (const j of [await interview(z, Q), await townyTest(z, Q)]) {
      const lines = j.reply.split("\n");
      expect(lines[0]).toBe("Here are the candidates in each race.");
      // Civic NO-GO f2a5046 P1: the ZIP-wide answer scopes the sentence to its confirmed races (78701: 47, 10001: 6).
      const n = z === "78701" ? 47 : 6;
      expect(lines[1].startsWith(`${orderConfirmedScoped(n)} `)).toBe(true);
      expect(j.reply).not.toContain(ORDER_CONFIRMED_HEAD);
      expect(j.reply).not.toContain(OLD_OPENER);
      expect(j.reply).not.toContain(OLD_HEAD);
      expect(j.reply.split(orderConfirmedScoped(n))).toHaveLength(2);
      expect(lines.filter((l) => l.startsWith(`${SPLIT_LINE}: `)).length).toBe(z === "78701" ? 3 : 2);
      // Civic NO-GO 4a9f8ea P1: 78701 has no unsplit race first, so no header; each of its lines ends with the Unsure line.
      if (z === "10001") expect(j.reply).toContain(`\n${ORDER_UNSURE} That applies to these races: `);
      else { expect(j.reply).not.toContain("That applies to these races"); expect(j.reply).toContain(ORDER_UNSURE); }
    }
  });
  it("94103 (no confirmed races) keeps the old opener on both endpoints", async () => {
    for (const j of [await interview("94103", Q), await townyTest("94103", Q)]) {
      expect(j.reply.startsWith(`Here are the candidates in each race. ${OLD_OPENER}`)).toBe(true);
      expect(j.reply).not.toContain(ORDER_CONFIRMED_HEAD);
    }
  });
  it("model path (/api/towny-test): the guard adds QA's line, not the pair; unsure-only replies keep the old line", async () => {
    run.mockResolvedValueOnce({ ok: true, model: "m", reply: "In ballot order: U.S. Senator: Ken Paxton, James Talarico, Ted Brown.", toolCalls: [], attempts: [] });
    const j = await townyTest("78701", "Who is running for U.S. Senator?");
    expect(j.handledBy).toBe("model");
    expect(j.reply).toContain(`${ORDER_CONFIRMED_HEAD} (Candidate order within: U.S. Senator.)`);
    expect(j.reply).not.toContain("The races here are not listed in the order");
    const sf = guardReply("94103", "In ballot order: Governor of California: Xavier Becerra, Steve Hilton.").reply;
    expect(sf).toContain("The races here are not listed in the order they appear on the ballot.");
    expect(sf).not.toContain(ORDER_CONFIRMED_HEAD);
  });
});

describe("P2: the 94103 hours link is labeled SF Department of Elections", () => {
  it("both endpoints, every hours phrasing; no 'Early voting source' label", async () => {
    for (const q of ["What are the hours?", "What are the early voting hours?", "What time do polls open and close?", "Where can I vote early and what are the hours?", "When is early voting?"]) {
      const a = await interview("94103", q), b = await townyTest("94103", q);
      expect(a.links!.some((l) => l.label === "Early voting source"), q).toBe(false);
      expect(b.reply, q).not.toContain("Early voting source");
      const l = a.links!.find((x) => x.url === SF_EV);
      if (l) expect(l.label).toBe("SF Department of Elections");
    }
    const h = await interview("94103", "What are the hours?");
    expect(h.links!.find((x) => x.url === SF_EV)!.label).toBe("SF Department of Elections");
    expect((await townyTest("94103", "What are the hours?")).reply).toContain(`Sources: SF Department of Elections: ${SF_EV}`);
  });
});
