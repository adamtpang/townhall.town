// Civic P1 (Oct 30 3:26 PM CT): the 10001 sample ballot is a third-party copy of an AD 71 ballot. It is relabeled, paired
// with the BOE lookup, and cited only for the 6 Manhattan-wide races. Split districts carry the "one of these" line.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import PrintBallot, { type PrintData } from "../app/card/PrintBallot";
import { printRules, officialOrder, orderCite, raceOrder, NY_COPY_LABEL, NY_COPY_RACES, NY_BOE_LOOKUP } from "../lib/printRules";
import { SPLIT_LINE, SHOW_SPLIT_LINE, splitStart, ORDER_CONFIRMED_LINE } from "../lib/printText";
import { ballotFor } from "../lib/tools";

const ST = { "78701": "TX", "94103": "CA", "10001": "NY" } as const;
function html(zip: keyof typeof ST) {
  const b = ballotFor(zip)!;
  const data: PrintData = { state: ST[zip], verify: null, rules: printRules(ST[zip]), measures: [], orderCite: orderCite(zip),
    races: raceOrder(zip, b.races).map((r) => { const o = officialOrder(zip, r.id, r.candidates.map((c) => ({ name: c.name, party: c.party ?? null }))); return { id: r.id, title: r.title, judicial: false, orderConfirmed: o.confirmed, candidates: o.candidates }; }) };
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
  const groups = { "78701": ["tx-10", "tx-hd-49"], "94103": ["sf-supervisor-6"], "10001": ["ny-sd-47", "ny-civil-3md-ny"] } as const;
  for (const z of Object.keys(groups) as (keyof typeof groups)[]) it(`${z}: one line per split group, with the official lookup`, () => {
    const h = html(z);
    const got = [...h.matchAll(/data-print-split="([^"]+)"/g)].map((m) => m[1]);
    expect(got).toEqual([...groups[z]]);
    expect(h.split(SPLIT_LINE.replace("\u2019", "&#x27;")).length + h.split(SPLIT_LINE).length - 2).toBe(groups[z].length);
    // The approved sentence sits directly above the official lookup link, in the same block.
    const url = splitStart(z, groups[z][0], got.concat(z === "78701" ? ["tx-37"] : z === "94103" ? ["sf-supervisor-8"] : ["ny-sd-28"]).filter((x) => x !== groups[z][1]))!.url;
    const host = new URL(url).hostname.replace(/^www\./, "");
    for (const id of groups[z]) {
      const blk = h.match(new RegExp(`data-print-split="${id}"[\\s\\S]*?</div>`))![0];
      expect(blk).toMatch(/<p data-print-split-line="true">Depending on your address, you(&#x27;|\u2019)ll have one of these<\/p><p data-print-split-link="true"><span class="pb-label">/);
      expect(blk).toContain(host);
    }
  });
  it("each split intro and its races are one group block (Design P1, 3:43 PM CT)", () => {
    const want = { "78701": ["tx-10 tx-37", "tx-hd-49 tx-house-51"], "94103": ["sf-supervisor-6 sf-supervisor-8 sf-supervisor-10"], "10001": ["ny-sd-47 ny-sd-28", "ny-civil-3md-ny ny-civil-9md-ny"] } as const;
    for (const z of Object.keys(want) as (keyof typeof want)[]) {
      const h = html(z);
      expect([...h.matchAll(/class="pb-split-group" data-print-split-group="([^"]+)"/g)].map((m) => m[1])).toEqual([...want[z]]);
      expect(h).not.toMatch(/data-print-split="[^"]+"[^>]*class="[^"]*pb-strong/);
      expect(h).toMatch(/<div class="pb-split" data-print-split="/);
    }
  });
  it("the sentence is behind one flag, on, word for word", () => {
    expect(SHOW_SPLIT_LINE).toBe(true);
    expect(SPLIT_LINE).toBe("Depending on your address, you\u2019ll have one of these");
    expect(splitStart("78701", "tx-10", ["tx-10", "tx-37"])!.line).toBe(SPLIT_LINE);
  });
  it("lookups are the official ones", () => {
    expect(splitStart("78701", "tx-10", ["tx-10", "tx-37"])!.url).toBe("https://teamrv-mvp.sos.texas.gov/MVP/mvp.do");
    expect(splitStart("94103", "sf-supervisor-6", ["sf-supervisor-6", "sf-supervisor-8"])!.url).toBe("https://voterstatus.sos.ca.gov/");
    expect(splitStart("10001", "ny-sd-47", ["ny-sd-47", "ny-sd-28"])!.url).toBe("https://findmypollsite.vote.nyc/");
    expect(splitStart("10001", "ny-sd-28", ["ny-sd-47", "ny-sd-28"])).toBeNull();
    expect(splitStart("10001", "ny-civil-3md-ny", ["ny-civil-3md-ny", "ny-civil-9md-ny"])!.url).toBe("https://findmypollsite.vote.nyc/");
    expect(splitStart("10001", "ny-civil-9md-ny", ["ny-civil-3md-ny", "ny-civil-9md-ny"])).toBeNull();
  });
  it("10001 Civil Court 3rd and 9th Municipal Court Districts are one split group, both daggered and unconfirmed", () => {
    const h = html("10001");
    const blk = h.match(/data-print-split="ny-civil-3md-ny"[\s\S]*?<\/div>/)![0];
    expect(blk).toContain("one of these");
    expect(blk).toContain("findmypollsite.vote.nyc");
    for (const id of ["ny-civil-3md-ny", "ny-civil-9md-ny"]) {
      expect(officialOrder("10001", id, [{ name: "x" }]).confirmed).toBe(false);
      expect(raceLi(h, id)).toContain("data-print-dagger");
      expect(raceLi(h, id)).not.toContain("data-print-order-confirmed");
    }
  });
});

describe("10001 race order and the AD 71 footnote (Civic P1/P2, 3:35 PM CT)", () => {
  it("prints Governor, Comptroller, Attorney General first, then the rest in their relative order", () => {
    const h = html("10001");
    const ids = [...h.matchAll(/data-print-race="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.slice(0, 7)).toEqual(["ny-governor", "ny-comptroller", "ny-attorney-general", "ny-12", "ny-sd-47", "ny-sd-28", "ny-ad-75"]);
    const orig = ballotFor("10001")!.races.map((r) => r.id).filter((id) => !["ny-governor", "ny-comptroller", "ny-attorney-general"].includes(id));
    // Civic print29 P2 (c): Surrogate, Supreme 1st JD, Civil County take the AD71 sequence in their slots.
    const courts = ["ny-surrogate-ny", "ny-supreme-1jd", "ny-civil-county-ny"]; let k = 0;
    expect(ids.slice(3)).toEqual(orig.map((id) => (courts.includes(id) ? courts[k++] : id)));
    expect(ids.indexOf("ny-surrogate-ny")).toBeLessThan(ids.indexOf("ny-supreme-1jd"));
    expect(ids.indexOf("ny-supreme-1jd")).toBeLessThan(ids.indexOf("ny-civil-county-ny"));
    expect(raceOrder("78701", [{ id: "a" }, { id: "b" }]).map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("prints the AD 71 label once, as one footnote, and each of the 6 races gets only the short line", () => {
    const h = html("10001");
    const lbl = NY_COPY_LABEL.replace("'", "&#x27;");
    expect(h.split(lbl).length - 1).toBe(1);
    const note = h.match(/<li[^>]*data-print-note="(\d+)"><span class="pb-num">\[\d+\]<\/span> ([^<]*)/g)!.find((x) => x.includes(lbl))!;
    const n = note.match(/data-print-note="(\d+)"/)![1];
    for (const id of NY_COPY_RACES) {
      const line = raceLi(h, id).match(/<p class="pb-order" data-print-order-confirmed="race">([\s\S]*?)<\/p>/)![1];
      expect(line.replace(/<[^>]+>/g, "").replace(/\u00a0/g, " ")).toBe(`${ORDER_CONFIRMED_LINE} [${n}]`);
    }
    expect(h).toContain(NY_BOE_LOOKUP.label);
  });
});
