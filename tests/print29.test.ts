// Civic print29 (Oct 30, 2026, 3:50 PM CT): address-dependent races from ballots.json's flags are split groups (line +
// lookup + dagger, no confirmed-order claim), the Who count counts a split group once, and the P2 fixes.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import PrintBallot, { type PrintData } from "../app/card/PrintBallot";
import { printRules, officialOrder, orderCite, raceOrder } from "../lib/printRules";
import { ORDER_CONFIRMED_LINE, ORDER_CONFIRMED_SHEET_LINE, RETENTION_KEY_LINE, SPLIT_LINE, SPLIT_LOOKUP, ballotSlots, splitGroupsFor, splitIds } from "../lib/printText";
import { ballotFor } from "../lib/tools";

const ST = { "78701": "TX", "94103": "CA", "10001": "NY" } as const;
type Z = keyof typeof ST;
const flagged = (zip: Z) => ballotFor(zip)!.races.filter((r) => (r as { dependsOnAddress?: boolean }).dependsOnAddress === true).map((r) => r.id);
function build(zip: Z) {
  const races = raceOrder(zip, ballotFor(zip)!.races);
  const groups = splitGroupsFor(zip, races.map((r) => ({ id: r.id, title: r.title, addressDependent: (r as { dependsOnAddress?: boolean }).dependsOnAddress === true })));
  const inSplit = splitIds(groups);
  const data: PrintData = { state: ST[zip], verify: null, rules: printRules(ST[zip]), measures: [], orderCite: orderCite(zip), splitGroups: groups,
    races: races.map((r) => { const o = officialOrder(zip, r.id, r.candidates.map((c) => ({ name: c.name, party: c.party ?? null }))); return { id: r.id, title: r.title, judicial: false, orderConfirmed: o.confirmed && !inSplit.has(r.id), candidates: o.candidates }; }) };
  const html = renderToStaticMarkup(createElement(PrintBallot, { zip, today: "2026-10-30", data, lookupUrl: SPLIT_LOOKUP[zip], dependsOnAddress: true }));
  return { groups, html, data };
}
const li = (h: string, id: string) => (h.match(new RegExp(`<li[^>]*data-print-race="${id}"[\\s\\S]*?</ul>`)) || [""])[0];

describe("print29 P1: split groups come from the dependsOnAddress flags", () => {
  it("every flagged race in every ZIP is in a split group and daggered", () => {
    for (const zip of ["78701", "94103", "10001"] as Z[]) {
      const { groups, html } = build(zip);
      for (const id of flagged(zip)) {
        expect(groups.flat()).toContain(id);
        expect(li(html, id)).toContain('data-order-confirmed="0"');
        expect(li(html, id)).not.toContain(ORDER_CONFIRMED_LINE);
      }
    }
  });
  it("78701: JP 5 + JP 4 are one group; Commissioner 4 and Constable 4 are groups of one, each with the line and TX lookup", () => {
    const { groups, html } = build("78701");
    expect(groups).toContainEqual(["travis-jp-5", "travis-jp-4"]);
    expect(groups).toContainEqual(["travis-commissioner-4"]);
    expect(groups).toContainEqual(["travis-constable-4-unexpired"]);
    for (const first of ["travis-commissioner-4", "travis-jp-5", "travis-constable-4-unexpired"]) {
      const m = html.match(new RegExp(`<li class="pb-split-group"[^>]*>(?:(?!<li class="pb-split-group").)*?data-print-race="${first}"`, "s"));
      expect(m, first).toBeTruthy();
      expect(m![0]).toContain(SPLIT_LINE);
      expect(m![0]).toContain("teamrv-mvp.sos.texas.gov");
    }
    expect(html).not.toContain('data-print-order-confirmed="sheet"');
  });
  it("Who count: one slot per split group. 78701 58 -> 55, 94103 32 -> 30, 10001 13 -> 11", () => {
    const want = { "78701": [58, 55], "94103": [32, 30], "10001": [13, 11] } as const;
    for (const zip of ["78701", "94103", "10001"] as Z[]) {
      const { groups, data, html } = build(zip);
      const races = data.races.filter((r) => r.candidates.length);
      expect(races.length).toBe(want[zip][0]);
      expect(ballotSlots(races, groups).length).toBe(want[zip][1]);
      expect(html).toContain(`0 of ${want[zip][1]} picked`);
    }
  });
  it("10001 Council 3 gets the split line and the NYC lookup", () => {
    const { groups, html } = build("10001");
    expect(groups).toContainEqual(["nyc-council-3"]);
    const m = html.match(/<li class="pb-split-group"(?:(?!<li class="pb-split-group").)*?data-print-race="nyc-council-3"/s);
    expect(m![0]).toContain("findmypollsite.vote.nyc");
  });
});
describe("print29 P2", () => {
  it("(a)(b) the sheet line is Civic's wording with no repeated lowercase label", () => {
    expect(ORDER_CONFIRMED_SHEET_LINE).toBe("Candidates are listed in the order on the official sample ballot.");
    expect(orderCite("78701")!.label).toMatch(/^Official sample \(bedsheet\) ballot/);
    expect(build("78701").html).not.toContain("ballot. official sample");
  });
  it("(f) retention key note on 94103 only", () => {
    expect(build("94103").html).toContain(RETENTION_KEY_LINE);
    expect(build("78701").html).not.toContain(RETENTION_KEY_LINE);
    expect(build("10001").html).not.toContain(RETENTION_KEY_LINE);
  });
  it("(g) no trailing period on the CA 14212 URL", () => {
    const h = build("94103").html;
    expect(h).toContain("sectionNum=14212");
    expect(h).not.toMatch(/sectionNum=14212\./);
  });
});
