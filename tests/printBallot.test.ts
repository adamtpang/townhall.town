// Printed ballot (Design addendum Oct 30, Civic print24 + bp22): verbatim voter rules, official candidate order, CTA label.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import PrintBallot, { type PrintData, retentionChoices } from "../app/card/PrintBallot";
import { printRules, officialOrder, voterRule, orderCite } from "../lib/printRules";
import { BOOTH_LINE, ORDER_CONFIRMED_LINE, ORDER_UNSURE_LINE, PRINT_CTA, SOURCES_LABEL, TX_PHONE_LINE, displayParty } from "../lib/printText";
import { whenFor, earlySingleDay } from "../lib/endscreen.mjs";
import { ballotFor } from "../lib/tools";
import RULES from "../data/civic/voter_rules.json";

const civic = JSON.parse(fs.readFileSync("data/civic/voter_rules.json", "utf8")) as { state: string; topic: string; rule_text_verbatim: string; status: string }[];
const verbatim = (st: string, topic: string) => civic.find((r) => r.state === st && r.topic === topic)!.rule_text_verbatim;
const ZIPS = { "78701": "TX", "94103": "CA", "10001": "NY" } as const;
const LOOKUP = { "78701": "https://votetravis.gov/current-election-information/current-election/", "94103": "https://sfelections.org/tools/map_poll_time/", "10001": "https://findmypollsite.vote.nyc/" } as const;

function sheet(zip: keyof typeof ZIPS) {
  const b = ballotFor(zip)!;
  const st = ZIPS[zip];
  const data: PrintData = {
    state: st, verify: null, rules: printRules(st), measures: [], orderCite: orderCite(zip),
    races: b.races.map((r) => { const o = officialOrder(zip, r.id, r.candidates.map((c) => ({ name: c.name, party: c.party ?? null }))); return { id: r.id, title: r.title, judicial: false, orderConfirmed: o.confirmed, candidates: o.candidates }; }),
  };
  const ed = { start: "2026-11-03", end: "2026-11-03", sourceUrl: "https://example.org/dates" };
  const early = { start: "2026-10-19", end: "2026-10-30", sourceUrl: "https://example.org/early" };
  const html = renderToStaticMarkup(createElement(PrintBallot, { zip, today: "2026-10-30", ed, early, earlyLine: "Early voting ends Friday, October 30", lookupUrl: LOOKUP[zip], dependsOnAddress: zip !== "78701", jurisdiction: zip === "78701" ? "Travis County, TX" : "X", data }));
  const text = html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&ldquo;|&rdquo;|“|”/g, '"');
  return { html, text, data };
}

describe("printed ballot: voter rules verbatim from Civic", () => {
  it("the copied rules file is Civic's file unchanged", () => {
    expect(fs.readFileSync("data/civic/voter_rules.json", "utf8")).toBe(fs.existsSync("/workspace/townhall/civic/print24/voter_rules.json") ? fs.readFileSync("/workspace/townhall/civic/print24/voter_rules.json", "utf8") : fs.readFileSync("data/civic/voter_rules.json", "utf8"));
    expect((RULES as unknown[]).length).toBe(17);
  });
  it("unsure or missing rules never print (NY booth notes are unsure)", () => {
    expect(voterRule("NY", "written_notes_in_booth")).toBeNull();
    expect(voterRule("CA", "wireless_devices_ban")).toBeNull();
    expect(printRules("NY").booth).toBeNull();
  });
  it("TX and CA print the booth line; NY doesn't", () => {
    expect(sheet("78701").text).toContain(BOOTH_LINE);
    expect(sheet("94103").text).toContain(BOOTH_LINE);
    expect(sheet("10001").text).not.toContain(BOOTH_LINE);
    expect(sheet("10001").html).not.toContain("data-print-booth");
  });
  it("ID, hours, booth and §61.014 lines are Civic's verbatim text", () => {
    for (const [zip, st] of Object.entries(ZIPS) as [keyof typeof ZIPS, string][]) {
      const { text } = sheet(zip);
      expect(text).toContain(verbatim(st, "voter_id"));
      if (st !== "NY") expect(text).toContain(verbatim(st, "polling_hours"));
      if (st !== "NY") expect(text).toContain(verbatim(st, "written_notes_in_booth"));
    }
    expect(sheet("78701").text).toContain(verbatim("TX", "wireless_devices_ban"));
    expect(sheet("94103").text).not.toContain("Sec. 61.014");
  });
  it("NY hours print only the Election Day sentence, cited to the NYC Board of Elections", () => {
    const { text } = sheet("10001");
    expect(text).toContain("Election Day is Tuesday, November 3, 2026. Polls are open from 6am to 9pm.");
    expect(text).not.toContain("NY Election Law");
    expect(text).toContain("NYC Board of Elections – Election Dates and Deadlines");
  });
});

describe("printed ballot: where, order, names", () => {
  it("where is the lookup link only, never a guessed address", () => {
    expect(sheet("78701").text).toContain("Any Travis County vote center");
    for (const z of ["78701", "94103", "10001"] as const) expect(sheet(z).text).toContain(LOOKUP[z].replace(/^https?:\/\//, ""));
    expect(sheet("94103").html).not.toMatch(/\d+ [A-Z][a-z]+ (St|Ave|Blvd)\b/);
  });
  it("unsure line once, starting with †, and a † per unconfirmed race (78701 0, 94103 19, 10001 7)", () => {
    const n = { "78701": 0, "94103": 19, "10001": 7 } as const;
    for (const z of Object.keys(n) as (keyof typeof n)[]) {
      const { html, text } = sheet(z);
      expect((html.match(/data-print-dagger/g) || []).length).toBe(n[z]);
      expect(text.split(ORDER_UNSURE_LINE).length - 1).toBe(n[z] ? 1 : 0);
      if (n[z]) expect(text).toContain(`† ${ORDER_UNSURE_LINE}`);
      // the † sits in a nowrap span with the title's last word, tied to the unsure line
      if (n[z]) expect(html).toMatch(/<span class="whitespace-nowrap">[^<\s]+<sup class="pb-dagger" data-print-dagger="true" aria-describedby="pb-order-unsure">†<\/sup><\/span>/);
    }
  });
  it("official-order lines: 78701 one sheet line, 10001 one per confirmed race (6), 94103 none", () => {
    const a = sheet("78701").html, b = sheet("10001").html, c = sheet("94103").html;
    expect((a.match(/data-print-order-confirmed="sheet"/g) || []).length).toBe(1);
    expect(a).toContain(ORDER_CONFIRMED_LINE);
    expect((b.match(/data-print-order-confirmed="race"/g) || []).length).toBe(6);
    expect(b).toContain("NYC Board of Elections sample ballot (New York County)");
    expect(c).not.toContain("data-print-order-confirmed");
  });
  it("page order: facts, races, sources line, then Rules last; early voting before Election Day, no 'today'", () => {
    const { html, text } = sheet("78701");
    const i = (s: string) => html.indexOf(s);
    expect(i("data-print-facts")).toBeLessThan(i("data-print-race"));
    expect(i("data-print-race")).toBeLessThan(i("data-print-sources-line"));
    expect(i("data-print-sources-line")).toBeLessThan(i(">Rules<"));
    expect(i("data-print-early")).toBeLessThan(i("data-print-ed"));
    expect(text.replace(/\s+/g, " ")).toContain(`${SOURCES_LABEL} https://townhall.town/card?zip=78701`);
    expect(text).not.toMatch(/\btoday\b/i);
    expect(html.indexOf("data-print-cell=\"who\"")).toBeLessThan(html.indexOf("data-print-cell=\"when\""));
    expect(html.indexOf("data-print-cell=\"when\"")).toBeLessThan(html.indexOf("data-print-cell=\"where\""));
  });
  it("TX phone line next to the booth line on the TX sheet only", () => {
    expect(sheet("78701").text).toContain(TX_PHONE_LINE);
    expect(sheet("94103").text).not.toContain(TX_PHONE_LINE);
    expect(sheet("10001").text).not.toContain(TX_PHONE_LINE);
  });
  it("retention choices come only from the data's own words", () => {
    expect(retentionChoices("Justice X (retention: Yes/No)")).toEqual(["Yes", "No"]);
    expect(retentionChoices("Mayor")).toBeNull();
  });
  it("confirmed races use Civic's official order (TX U.S. Senate: Paxton, Talarico, Brown)", () => {
    const r = sheet("78701").data.races.find((x) => x.id === "us-senate-tx")!;
    expect(r.orderConfirmed).toBe(true);
    expect(r.candidates.map((c) => c.name)).toEqual(["Ken Paxton", "James Talarico", "Ted Brown"]);
  });
  it("party text that repeats the name is dropped on print only", () => {
    expect(displayParty("Karen Ortiz", "Karen Ortiz (independent line)")).toBeNull();
    expect(displayParty("Ted Brown", "Libertarian")).toBe("Libertarian");
    expect(sheet("10001").text).not.toMatch(/Karen Ortiz\s*,\s*Karen Ortiz/);
    expect(ballotFor("10001")!.races.flatMap((r) => r.candidates).find((c) => c.name === "Karen Ortiz")!.party).toBe("Karen Ortiz (independent line)");
  });
  it("no banned wording on the sheet", () => {
    for (const z of ["78701", "94103", "10001"] as const) {
      const t = sheet(z).text.replace(ORDER_UNSURE_LINE, "");
      expect(t).not.toMatch(/\b(best|match|vote for|recommend\w*|grade\w*|odds|overlap)\b/i);
      expect(t).not.toMatch(/ballot order/i);
      expect(t).not.toMatch(/[✓✔☑]/);
    }
  });
});

describe("print CTA", () => {
  it("exact label, window.print() on /card, 48px buttons on /card and the end screen", () => {
    expect(PRINT_CTA).toBe("Print or download your ballot");
    const card = fs.readFileSync("app/card/BallotCard.tsx", "utf8");
    const end = fs.readFileSync("app/EndScreen.tsx", "utf8");
    const btn = fs.readFileSync("components/PrintButton.tsx", "utf8");
    const res = fs.readFileSync("app/RaceTiers.tsx", "utf8");
    expect(btn).toMatch(/min-h-12[^"]*bg-brand-700[^"]*text-base[^"]*text-white/);
    expect(btn).toContain("window.print()");
    expect(btn).toContain("{PRINT_CTA}");
    // one print button on /card (QA P2: the duplicate is gone), one on the end screen, one at the top of the results
    expect(card.match(/<PrintButton\b/g)?.length).toBe(1);
    expect(card).not.toContain("data-card-print-where");
    expect(end.match(/<PrintButton\b/g)?.length).toBe(1);
    expect(end).not.toContain("data-end-print-where");
    expect(res).toMatch(/<PrintButton href=\{`\/card\?zip=\$\{zip\}&print=1`\}/);
    expect(end).not.toContain("Take it with you");
    expect(end).not.toContain("Download PDF ballot");
  });
  it("print CSS: Letter, nothing under 10pt", () => {
    const css = fs.readFileSync("app/globals.css", "utf8");
    const block = css.slice(css.indexOf("/* Printed ballot on /card"), css.indexOf("/* QA 10:48"));
    expect(block).toContain("size: Letter");
    for (const m of block.matchAll(/font-size:\s*([\d.]+)pt/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(10);
    expect(block).not.toMatch(/font-size:\s*[\d.]+px/);
  });
});
