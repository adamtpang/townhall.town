// v3.1 follow-up (Adam, Oct 30 2026 3:37 PM CT): Civic GO on 73ddcbf with P1/P2 fixes, on /api/interview and /api/towny-test.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { curated } from "../lib/towny/answer";
import { ORDER_CONFIRMED, ORDER_CONFIRMED_HEAD, ORDER_UNSURE, SPLIT_LINE, NY_FMPS, orderStatus } from "../lib/ballotOrder";
import { ballotFor, getRaces } from "../lib/tools";
import { guardReply } from "../lib/towny/orderGuard";
import { TOWNY_BRIEF } from "../lib/towny/brief";

const ORDER_Q = "What order are candidates on my ballot?";
const SF_HOURS = ["What are the hours?", "What time do polls open and close?", "Where can I vote early and what are the hours?", "Where do I vote and what are the hours?", "What are the early voting hours?"];
const RET = (ballotFor("94103")!.races as { id: string; title: string; candidates: { name: string }[] }[]).filter((r) => /\(retention\b/.test(r.title));
const root = join(__dirname, "..");

let interview: (zip: string, text: string) => Promise<{ reply: string; links: { url: string }[] }>;
let townyTest: (zip: string, message: string) => Promise<{ reply: string; handledBy: string; guard?: string[] }>;
const run = vi.fn();
let ip = 10;
beforeAll(async () => {
  vi.resetModules();
  vi.doMock("../lib/townyRun", () => ({ runTowny: run }));
  const i = await import("../app/api/interview/route");
  const t = await import("../app/api/towny-test/route");
  interview = async (zip, text) => (await i.POST(new Request("https://x/api/interview", { method: "POST", body: JSON.stringify({ zip, messages: [{ text }] }), headers: { "x-forwarded-for": `198.51.100.${ip++}`, "content-type": "application/json" } }))).json();
  townyTest = async (zip, message) => (await t.POST(new Request("https://x/api/towny-test", { method: "POST", body: JSON.stringify({ zip, message }) }))).json();
});

describe("P1-1 no 'weekend entry via Grove Street' anywhere", () => {
  it("data files and every SF hours reply on both endpoints", async () => {
    for (const f of ["data/election_dates.json", "data/civic/election_dates.json"]) expect(readFileSync(join(root, f), "utf8")).not.toMatch(/Grove Street/);
    for (const q of SF_HOURS) {
      const a = await interview("94103", q), b = await townyTest("94103", q);
      for (const r of [a.reply, b.reply]) {
        expect(r, q).not.toMatch(/Grove/);
        expect(r, q).toContain("Election Day, Tue, Nov 3: 7:00 AM-8:00 PM PT");
      }
    }
  });
});

describe("P1-2 10001 Civil Court 3rd/9th Municipal Court Districts are a split group, still unsure", () => {
  it("tools", () => {
    const r = getRaces("10001")!.races as { id: string; orderStatus: { status: string }; dependsOnAddress?: { say: string; oneOf: string[]; lookupUrl: string } }[];
    for (const id of ["ny-civil-3md-ny", "ny-civil-9md-ny"]) {
      const x = r.find((y) => y.id === id)!;
      expect(x.orderStatus.status).toBe("unsure");
      expect(x.dependsOnAddress).toMatchObject({ say: SPLIT_LINE, oneOf: ["ny-civil-3md-ny", "ny-civil-9md-ny"], lookupUrl: NY_FMPS.url });
    }
  });
  it("order answer on both endpoints", async () => {
    for (const j of [await interview("10001", ORDER_Q), await townyTest("10001", ORDER_Q)]) {
      const line = j.reply.split("\n").find((l) => l.includes("3rd Municipal Court District"))!;
      expect(line.startsWith(`${SPLIT_LINE}: Judge of the Civil Court, District, 3rd Municipal Court District, New York: Steven Benathen; Judge of the Civil Court, District, 9th Municipal Court District`)).toBe(true);
      const unsure = j.reply.indexOf(ORDER_UNSURE), conf = j.reply.indexOf(ORDER_CONFIRMED);
      expect(unsure).toBeGreaterThan(conf);
      expect(j.reply.indexOf(line)).toBeGreaterThan(unsure);
    }
    expect((await interview("10001", ORDER_Q)).links.map((l) => l.url)).toContain("https://findmypollsite.vote.nyc/");
    expect(curated("10001", "Who is running for Judge of the Civil Court, District?")!.reply).toMatch(new RegExp(`^${SPLIT_LINE}: .*3rd Municipal.*9th Municipal[^]*${ORDER_UNSURE.replace(/[.,]/g, "\\$&")}$`));
  });
});

describe("P2-3 where and hours: no 'For hours and polling places' sentence", () => {
  it("both endpoints, SF; the office is still named for the polling place", async () => {
    for (const q of ["Where can I vote early and what are the hours?", "Where do I vote and what are the hours?"]) {
      for (const j of [await interview("94103", q), await townyTest("94103", q)]) {
        expect(j.reply, q).not.toMatch(/For hours and polling places/);
        expect(j.reply, q).toContain("For your polling place, check the SF Department of Elections.");
        expect(j.reply, q).toContain("Hours at City Hall Voting Center: ");
      }
    }
  });
});

describe("P2-4 the 13 SF retention races get no order line", () => {
  it("there are 13, and the tools say status retention with nothing to say", () => {
    expect(RET).toHaveLength(13);
    for (const r of RET) expect(orderStatus("94103", r.id, r.title)).toMatchObject({ status: "retention", say: "" });
    expect(TOWNY_BRIEF).toMatch(/orderStatus \\?"retention\\?"[^.]*: no order line/);
  });
  it("/api/interview: who is running and order questions for each retention race", async () => {
    for (const r of RET) {
      const office = r.title.replace(/: [^:(]+ \(retention[^)]*\)$/, "").replace(/ \(retention[^)]*\)$/, "");
      for (const q of [`Who is running for ${office}?`, `What order are the candidates for ${office}?`]) {
        const j = await interview("94103", q);
        expect(j.reply, q).toContain(r.candidates[0].name);
        expect(j.reply, q).not.toContain(ORDER_UNSURE);
        expect(j.reply, q).not.toContain(ORDER_CONFIRMED);
        expect(j.reply, q).not.toMatch(/ballot order|order on the official/i);
      }
    }
  });
  it("/api/towny-test: order questions answered in code; model replies about retention races lose the order line", async () => {
    for (const r of RET) {
      const office = r.title.replace(/: [^:(]+ \(retention[^)]*\)$/, "").replace(/ \(retention[^)]*\)$/, "");
      const j = await townyTest("94103", `What order are the candidates for ${office}?`);
      expect(j.handledBy).toBe("code");
      expect(j.reply).not.toContain(ORDER_UNSURE);
      run.mockResolvedValueOnce({ ok: true, model: "m", reply: `${r.title.replace(/ \(retention.*$/, "")}: ${r.candidates[0].name} is up for retention (Yes or No). ${ORDER_UNSURE}`, toolCalls: [], attempts: [] });
      const m = await townyTest("94103", `Who is running for ${office}?`);
      expect(m.handledBy).toBe("model");
      expect(m.reply).toContain(r.candidates[0].name);
      expect(m.reply).not.toContain(ORDER_UNSURE);
    }
    // a non-retention race keeps its line
    expect(guardReply("94103", `Governor of California: Xavier Becerra, Steve Hilton. ${ORDER_UNSURE}`).reply).toContain(ORDER_UNSURE);
  });
  it("whole-ZIP order answer lists retention races apart, with no order line", async () => {
    for (const j of [await interview("94103", ORDER_Q), await townyTest("94103", ORDER_Q)]) {
      const line = j.reply.split("\n").find((l) => l.startsWith("Retention races, a Yes or No vote on one judge each:"))!;
      expect(line).toBeTruthy();
      for (const r of RET) expect(line).toContain(r.candidates[0].name);
      const unsureLine = j.reply.split("\n").find((l) => l.startsWith(ORDER_UNSURE))!;
      expect(unsureLine).not.toMatch(/retention/);
    }
  });
});

describe("P2-5 78701: the split group is its own line", () => {
  it("both endpoints", async () => {
    for (const j of [await interview("78701", ORDER_Q), await townyTest("78701", ORDER_Q)]) {
      const lines = j.reply.split("\n");
      expect(lines[1]).toBe(ORDER_CONFIRMED_HEAD); // QA 297e948 P1
      const splits = lines.filter((l) => l.includes(SPLIT_LINE));
      expect(splits).toHaveLength(2);
      for (const l of splits) expect(l.startsWith(`${SPLIT_LINE}: `)).toBe(true);
      expect(j.reply).not.toMatch(new RegExp(`races: ${SPLIT_LINE}`));
    }
  });
  it("the chat bubbles keep the line breaks", () => {
    expect(readFileSync(join(root, "components/towny/TownyFab.tsx"), "utf8")).toMatch(/whitespace-pre-line text-base leading-6/);
    expect(readFileSync(join(root, "app/TownyInterview.tsx"), "utf8")).toMatch(/whitespace-pre-line bg-black\/\[0\.04\]/);
  });
});
