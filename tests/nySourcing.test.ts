// Civic P1 (Oct 30 3:26 PM CT): the 10001 sample ballot is a third-party copy of an AD 71 ballot. It is relabeled, paired
// with the BOE lookup, and cited only for the 6 Manhattan-wide races. Split districts carry the "one of these" line.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import PrintBallot, { type PrintData } from "../app/card/PrintBallot";
import { printRules, officialOrder, orderCite, NY_COPY_LABEL, NY_COPY_RACES, NY_BOE_LOOKUP } from "../lib/printRules";
import { SPLIT_LINE, splitStart } from "../lib/printText";
import { ballotFor } from "../lib/tools";

const ST = { "78701": "TX", "94103": "CA", "10001": "NY" } as const;
function html(zip: keyof typeof ST) {
  const b = ballotFor(zip)!;
  const data: PrintData = { state: ST[zip], verify: null, rules: printRules(ST[zip]), measures: [], orderCite: orderCite(zip),
    races: b.races.map((r) => { const o = officialOrder(zip, r.id, r.candidates.map((c) => ({ name: c.name, party: c.party ?? null }))); return { id: r.id, title: r.title, judicial: false, orderConfirmed: o.confirmed, candidates: o.candidates }; }) };
  return renderToStaticMarkup(createElement(PrintBallot, { zip, today: "2026-10-30", data, lookupUrl: "https://findmypollsite.vote.nyc/", dependsOnAddress: true }));
}
const raceLi = (h: string, id: string) => { const m = h.match(new RegExp(`<li[^>]*data-print-race="${id}"[\\s\\S]*?</ul>`)); return m ? m[0] : ""; };

describe("10001 sample-ballot sourcing", () => {
  it("relabels the wsimg copy exactly, keeps its URL, and pairs it with the BOE lookup", () => {
    const oc = orderCite("10001")!;
    expect(oc.label).toBe("Copy of an official NYC Board of Elections ballot (New York County, Assembly District 71), posted on a third-party website, not the Board's");
    expect(oc.label).toBe(NY_COPY_LABEL);
    expect(oc.url).toMatch(/^https:\/\/img1\.wsimg\.com\//);
    expect(oc.also).toEqual({ label: "Find My Poll Site / View Sample Ballot, NYC Board of Elections", url: "https://findmypollsite.vote.nyc/" });
    const h = html("10001");
    expect(h).not.toContain("NYC Board of Elections sample ballot (New York County)");
    expect(h).toContain(NY_BOE_LOOKUP.label);
  });
  it("cites the copy only for the 6 Manhattan-wide races, never NY-12, State Senate, AD 75 or Council 3", () => {
    const h = html("10001");
    const cited = [...h.matchAll(/data-print-race="([^"]+)"[^>]*>(?:(?!<\/ul>)[\s\S])*?data-print-order-confirmed="race"/g)].map((m) => m[1]);
    expect(cited.sort()).toEqual([...NY_COPY_RACES].sort());
    for (const id of ["ny-12", "ny-sd-47", "ny-sd-28", "ny-ad-75", "nyc-council-3"]) {
      expect(officialOrder("10001", id, [{ name: "x" }]).confirmed).toBe(false);
      expect(raceLi(h, id)).not.toContain("data-print-order-confirmed");
      expect(raceLi(h, id)).toContain("data-print-dagger");
    }
  });
});

describe("split districts", () => {
  const groups = { "78701": ["tx-10", "tx-hd-49"], "94103": ["sf-supervisor-6"], "10001": ["ny-sd-47"] } as const;
  for (const z of Object.keys(groups) as (keyof typeof groups)[]) it(`${z}: one line per split group, with the official lookup`, () => {
    const h = html(z);
    const got = [...h.matchAll(/data-print-split="([^"]+)"/g)].map((m) => m[1]);
    expect(got).toEqual([...groups[z]]);
    expect(h.split(SPLIT_LINE.replace("\u2019", "&#x27;")).length + h.split(SPLIT_LINE).length - 2).toBe(groups[z].length);
  });
  it("lookups are the official ones", () => {
    expect(splitStart("78701", "tx-10", ["tx-10", "tx-37"])!.url).toBe("https://teamrv-mvp.sos.texas.gov/MVP/mvp.do");
    expect(splitStart("94103", "sf-supervisor-6", ["sf-supervisor-6", "sf-supervisor-8"])!.url).toBe("https://voterstatus.sos.ca.gov/");
    expect(splitStart("10001", "ny-sd-47", ["ny-sd-47", "ny-sd-28"])!.url).toBe("https://findmypollsite.vote.nyc/");
    expect(splitStart("10001", "ny-sd-28", ["ny-sd-47", "ny-sd-28"])).toBeNull();
  });
});
