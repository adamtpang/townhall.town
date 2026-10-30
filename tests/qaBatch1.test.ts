// QA on 4d1940b (parent steering 2:47 PM CT Oct 30): P0s fixed by the 7c281a6 base, plus P1 ZIP-notice and P2 dictionary string.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BallotCard from "../app/card/BallotCard";
import { ballotFor } from "../lib/tools";
import { ISSUES } from "../lib/issues";
import { ES_FOR_TEST as DICT } from "../lib/i18n";

const src = (p: string) => fs.readFileSync(p, "utf8");
const ids = ISSUES.map((i) => i.id);
const card = (z: string) => { const b = ballotFor(z)!; return renderToStaticMarkup(h(BallotCard, { zip: z, place: z, ids, races: b.races as never })); };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("QA batch1 P0s", () => {
  for (const z of ["78701", "94103", "10001"]) {
    it(`${z}: card has a Google Calendar render?action=TEMPLATE link, not only .ics`, () => {
      const m = card(z).match(/data-card-gcal="([^"]+)"/);
      expect(m).toBeTruthy();
      const u = new URL(m![1].replace(/&amp;/g, "&"));
      expect(u.origin + u.pathname).toBe("https://calendar.google.com/calendar/render");
      expect(u.searchParams.get("action")).toBe("TEMPLATE");
    });
  }
  it("94103: early voting never reads Friday Oct 30 to Tuesday Nov 3", () => {
    const t = text(card("94103"));
    expect(t).not.toMatch(/Oct(ober)? 30[^.]{0,40}(to|through|-|–)[^.]{0,20}(Tue(sday)?,? )?Nov(ember)? 3/i);
    expect(t).not.toMatch(/runs through (Tue(sday)?, )?Nov(ember)? 3/i);
  });
  it("ZIP input keeps pattern=[0-9]* with a numeric keypad", () => {
    const s = src("app/BallotAgent.tsx");
    expect(s).toContain('pattern="[0-9]*"');
    expect(s).toContain('inputMode="numeric"');
  });
});

describe("QA batch1 P1/P2", () => {
  it("P1: 'Austin, SF and NYC for now.' is not in the server HTML under the ZIP input (notice starts empty)", () => {
    const s = src("app/BallotAgent.tsx");
    expect(s).toMatch(/useState<string \| null>\(null\);/);
    expect(s).toMatch(/data-zip-notice>\{notice \? t\(notice\) : ""\}<\/p>/);
    for (const f of ["app/page.tsx", "app/layout.tsx"]) expect(src(f)).not.toContain("for now.");
  });
  it("P2: the dictionary string 'Candidates are shown in ballot order' is gone", () => {
    expect(JSON.stringify(DICT)).not.toMatch(/shown in ballot order/i);
    expect(src("lib/i18n.tsx")).not.toMatch(/shown in ballot order/i);
  });
});
