// QA P1 on 3e16451 (Oct 30): "money only renders on the US Senate race". Expanding TX-37 (Casar, Peña) or NY-12
// (Lasher, Shinkle, Negron, Ortiz) in "Who lines up" showed no Raised, Cash on hand, through date or FEC link. Rule:
// every race whose candidates carry money rows renders those rows in the page, in the race list and in Who.
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ballotFor } from "../lib/tools";
import { fecIdOf } from "../lib/fec";
import RaceTiers from "../app/RaceTiers";

type Cand = { name: string; money?: { raised: number; cashOnHand: number; coverageThrough?: string | null } };
const ZIPS = ["78701", "94103", "10001"];
const moneyRaces = (zip: string) => ballotFor(zip)!.races.filter((r) => (r.candidates as Cand[]).some((c) => c.money));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const cells = (seg: string) => (seg.match(/data-money="true"/g) ?? []).length;

function checkSegment(seg: string, cands: Cand[], where: string) {
  const withMoney = cands.filter((c) => c.money);
  expect(cells(seg), `${where}: money cells`).toBe(withMoney.length);
  for (const c of withMoney) {
    const cell = seg.split(`data-finance-cand="${esc(c.name)}"`)[1]?.split("data-finance-cand=")[0] ?? "";
    expect(cell, `${where} ${c.name}`).toMatch(/data-raised="true">\$/);
    expect(cell, `${where} ${c.name}`).toMatch(/data-coh="true">-?\$/);
    if (c.money!.coverageThrough) expect(cell, `${where} ${c.name}`).toContain(`data-through="${c.money!.coverageThrough}"`);
    expect(cell, `${where} ${c.name}`).toContain(`href="https://www.fec.gov/data/candidate/${fecIdOf(c as never)}/"`);
  }
}

describe("every race with money rows renders them (QA P1, 3e16451)", () => {
  it("the 3 ZIPs have money on more than the Senate race (TX-37, TX-10, CA-11, NY-12)", () => {
    const got = Object.fromEntries(ZIPS.map((z) => [z, moneyRaces(z).map((r) => `${r.id}:${(r.candidates as Cand[]).filter((c) => c.money).length}`)]));
    expect(got).toEqual({ "78701": ["tx-10:2", "tx-37:2", "us-senate-tx:3"], "94103": ["ca-11:2"], "10001": ["ny-12:4"] });
  });
  it("Who lines up: each expanded race shows Raised, Cash on hand, through date and FEC link for every candidate with money", async () => {
    const { default: EndScreen } = await import("../app/EndScreen");
    for (const zip of ZIPS) {
      const out = renderToStaticMarkup(h(EndScreen, { zip, races: ballotFor(zip)!.races as never, answers: {}, ids: [], answered: 0 }));
      for (const r of moneyRaces(zip)) {
        const seg = out.split(`data-who-finance="${r.id}"`)[1]?.split(/data-who-finance="|data-race="/)[0];
        expect(seg, `${zip} ${r.id}: no money block in Who`).toBeTruthy();
        checkSegment(seg!, r.candidates as Cand[], `${zip} Who ${r.id}`);
      }
    }
  });
  it("race list: every money race rendered on first paint shows all its money cells (the rest are behind Show all; browser check covers them)", () => {
    for (const zip of ZIPS) {
      const out = renderToStaticMarkup(h(RaceTiers, { races: ballotFor(zip)!.races as never, market: () => null as never, zip }));
      for (const r of moneyRaces(zip)) {
        const parts = out.split(/<h3 /).filter((p) => p.includes(`>${esc(r.title || r.id)}<`));
        for (const p of parts) checkSegment(p, r.candidates as Cand[], `${zip} tiers ${r.id}`);
      }
    }
  });
});
