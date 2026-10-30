// Civic P0 (Oct 30, 3:05 PM CT): no page, PDF or tile tells voters to use a phone in the booth, photograph a ballot or
// take a ballot selfie. TX bans wireless device use in the voting room; CA/NY are unsure, so we never claim phones are
// allowed. The only phone copy is Adam's approved TX line (3:07 PM CT) and the "Phones and devices" rule heading that
// sits over Civic's verbatim TX ban.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import BallotCard from "../app/card/BallotCard";
import RaceTiers from "../app/RaceTiers";
import type { PrintData } from "../app/card/PrintBallot";
import { printRules, officialOrder, orderCite } from "../lib/printRules";
import { TX_PHONE_LINE } from "../lib/printText";
import { ballotFor } from "../lib/tools";

const ZIPS = { "78701": "TX", "94103": "CA", "10001": "NY" } as const;
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const BAD = /pull (it |this )?up on (your|a) phone|use (your|a) phone|on your phone|phones? (are|is) (allowed|ok|fine|permitted)|phone in the (booth|voting)|bring (your|a) phone|selfie|photo(graph)? (of )?(your |a |the )?(marked )?ballot|take a (photo|picture)|snap a/i;

function card(zip: keyof typeof ZIPS) {
  const b = ballotFor(zip)!; const st = ZIPS[zip];
  const print: PrintData = { state: st, verify: null, rules: printRules(st), measures: [], orderCite: orderCite(zip),
    races: b.races.map((r) => { const o = officialOrder(zip, r.id, r.candidates.map((c) => ({ name: c.name, party: c.party ?? null }))); return { id: r.id, title: r.title, judicial: false, orderConfirmed: o.confirmed, candidates: o.candidates }; }) };
  const races = b.races.map((r) => ({ id: r.id, title: r.title, level: r.level, judicial: !!(r as { judicial?: unknown }).judicial, candidates: r.candidates.map((c) => ({ name: c.name, party: c.party })) }));
  return strip(renderToStaticMarkup(createElement(BallotCard, { zip, place: b.place, ids: [], races, print })));
}

describe("phone and photo-in-booth wording (Civic P0)", () => {
  for (const zip of Object.keys(ZIPS) as (keyof typeof ZIPS)[]) {
    it(`/card and its printed sheet, ${zip}`, () => {
      const t = card(zip);
      expect(t).not.toMatch(BAD);
      const rest = t.split(TX_PHONE_LINE).join(" ").replace(/Phones and devices/g, " ");
      expect(rest).not.toMatch(/\b(cell ?)?phones?\b/i);
      if (zip === "78701") expect(t).toContain(TX_PHONE_LINE); else expect(t).not.toContain(TX_PHONE_LINE);
    });
    it(`results page tiers, ${zip}`, () => {
      const b = ballotFor(zip)!;
      const t = strip(renderToStaticMarkup(createElement(RaceTiers, { races: b.races as never, market: () => null as never, zip })));
      expect(t).toContain("What matters on your ballot");
      expect(t).not.toMatch(BAD);
      expect(t).not.toMatch(/\b(cell ?)?phones?\b/i);
    });
  }
  it("the grep catches the wording it is for", () => {
    for (const x of ["Pull this up on your phone in the booth", "Take a photo of your ballot", "ballot selfie"]) expect(x).toMatch(BAD);
    expect("Texas Driver License containing the person's photograph").not.toMatch(BAD);
  });
  it("rendered PDFs, when present (scripts in /workspace/townhall/print/v3)", () => {
    for (const zip of Object.keys(ZIPS)) {
      const f = `/workspace/townhall/print/v3/ballot-${zip}.txt`;
      if (!fs.existsSync(f)) continue;
      const t = fs.readFileSync(f, "utf8").replace(/\s+/g, " ");
      expect(t).not.toMatch(BAD);
    }
  });
});
