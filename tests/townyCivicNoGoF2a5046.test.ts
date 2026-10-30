// Civic NO-GO on f2a5046 (Adam, Oct 30 2026 4:38 PM CT), P1 on the /api/interview ballot-order answer: the confirmed sentence
// covers only the races it names (real count from the data), every other race carries the Unsure line, retention races need
// none, and 10001 Council 3 gets the single-race split line with the Find My Poll Site lookup, the same as the print.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { ORDER_CONFIRMED_HEAD, ORDER_UNSURE, NY_PDF_LABEL, isRetention, officialOrder } from "../lib/ballotOrder";
import { splitPlan, SPLIT_LINE_ONE } from "../lib/printText";
import { ballotFor } from "../lib/tools";
import { curated } from "../lib/towny/answer";

const Q = "What order are candidates on my ballot?";
const ZIPS = ["78701", "94103", "10001"] as const;
const SCOPED = /^Races are not in ballot order\. In (?:these (\d+) races|this race), candidates are listed in the order on the official sample ballot: /;
const RET_LEAD = "Retention races, a Yes or No vote on one judge each:";
type R = { id: string; title: string; level?: string; dependsOnAddress?: boolean; appliesNote?: string; candidates?: { name: string }[] };
type J = { reply: string; links?: { label: string; url: string }[] };

const racesOf = (zip: string) => (ballotFor(zip)!.races as R[]).filter((r) => r.level !== "measure" && r.candidates?.length);
/** Expected status per race, from the data alone: confirmed = Civic's check AND not split/at-large (the print's dagger rule). */
function expected(zip: string) {
  const rs = racesOf(zip);
  const plan = splitPlan(zip, rs);
  return rs.map((r) => ({ r, status: isRetention(r) ? "retention" : officialOrder(zip, r.id) && !plan.inSplit.has(r.id) && !plan.atLarge.has(r.id) ? "confirmed" : "unsure" }));
}
/** Every line of the reply after the opener with its order status; a line without one fails the test. */
function statusLines(reply: string) {
  const lines = reply.split("\n");
  expect(lines[0].startsWith("Here are the candidates in each race.")).toBe(true);
  let inherit = false;
  return lines.slice(1).map((l) => {
    let status: string | null = null;
    if (SCOPED.test(l)) status = "confirmed";
    else if (l.startsWith(RET_LEAD)) status = "retention";
    else if (l.includes(ORDER_UNSURE) || inherit) status = "unsure";
    inherit = l === `${ORDER_UNSURE} That applies to these races:`;
    expect(status, `line has no order status: ${l.slice(0, 120)}`).not.toBeNull();
    return { l, status };
  });
}
const label = (t: string) => t.replace(/\s*\((?:retention)[^)]*\)\s*$/i, "");

let interview: (zip: string, text: string) => Promise<J>;
let ip = 10;
beforeAll(async () => {
  vi.resetModules();
  vi.doMock("../lib/townyRun", () => ({ runTowny: vi.fn() }));
  const i = await import("../app/api/interview/route");
  interview = async (zip, text) => (await i.POST(new Request("https://x/api/interview", { method: "POST", body: JSON.stringify({ zip, messages: [{ text }] }), headers: { "x-forwarded-for": `198.51.100.${ip++}`, "content-type": "application/json" } }))).json();
});

describe("no race in any ZIP's order reply is left without an order status", () => {
  for (const zip of ZIPS) it(zip, async () => {
    for (const j of [curated(zip, Q, "2026-10-30")!, await interview(zip, Q)]) {
      const sl = statusLines(j.reply);
      expect(j.reply).not.toContain(ORDER_CONFIRMED_HEAD);
      for (const { r, status } of expected(zip)) {
        const hits = sl.filter((x) => x.l.includes(label(r.title)) && x.l.includes(r.candidates![0].name));
        expect(hits.length, `${zip} ${r.id}`).toBeGreaterThan(0);
        for (const h of hits) expect(h.status, `${zip} ${r.id}`).toBe(status);
      }
    }
  });
});

describe("the confirmed sentence names the real count from the data", () => {
  for (const zip of ZIPS) it(zip, async () => {
    const n = expected(zip).filter((x) => x.status === "confirmed").length;
    const j = await interview(zip, Q);
    const head = j.reply.split("\n").find((l) => SCOPED.test(l));
    if (!n) { expect(head).toBeUndefined(); expect(j.reply).toContain("The races are not listed in the order they appear on the ballot."); return; }
    expect(Number(SCOPED.exec(head!)![1] ?? 1)).toBe(n);
    expect(j.reply.split("\n").filter((l) => SCOPED.test(l))).toHaveLength(1);
  });
  it("the counts today: 78701 47, 10001 6, 94103 none", () => {
    expect(ZIPS.map((z) => expected(z).filter((x) => x.status === "confirmed").length)).toEqual([47, 0, 6]);
  });
});

describe("Civic's named races", () => {
  it("10001: AD75, the SD 47/28 group, the Civil 3rd/9th group and Council 3 each carry the Unsure line; the AD71 link stays first", async () => {
    const j = await interview("10001", Q);
    const lines = j.reply.split("\n");
    const line = (s: string) => lines.find((l) => l.includes(s))!;
    for (const s of ["Member of Assembly, District 75:", "State Senator, District 47:", "3rd Municipal Court District", "Member of the City Council, 3rd Council District:"]) expect(line(s), s).toContain(ORDER_UNSURE);
    expect(line("Member of the City Council, 3rd Council District:").startsWith(`${SPLIT_LINE_ONE} Member of the City Council, 3rd Council District: `)).toBe(true);
    expect(j.links!.map((l) => l.url)).toContain("https://findmypollsite.vote.nyc/");
    expect(j.links![0].label).toBe(NY_PDF_LABEL);
  });
  it("94103: the D6/8/10 group, Board of Education and Community College carry the Unsure line; retention races none", async () => {
    const j = await interview("94103", Q);
    const lines = j.reply.split("\n");
    for (const s of ["Board of Supervisors, District 6:", "Board of Education", "Community College Board"]) expect(lines.find((l) => l.includes(s)), s).toContain(ORDER_UNSURE);
    expect(lines.find((l) => l.startsWith(RET_LEAD))).not.toContain(ORDER_UNSURE);
  });
});
