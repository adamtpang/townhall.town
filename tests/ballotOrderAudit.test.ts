// Oct 30 round: ballot order from Civic's ballot_order_check.json (official_order) and stance eligibility from
// ballotpedia_stance_audit.json (keep_final / final_reason / recommended_chip_label / recommended_citation_url).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ballotFor } from "../lib/tools";
import { bareName } from "../lib/civicChecks.mjs";
import { orderLineFor, withOrderLines, ORDER_CONFIRMED_LINE, ORDER_UNSURE_LINE } from "../lib/towny/ballotOrder";
import { answerFollowup, positionsOf } from "../lib/towny/followup";
import { getCandidatePositions } from "../lib/townyTools";
import { stancesFor, ISSUES } from "../lib/issues";
import RaceTiers from "../app/RaceTiers";
import BallotCard from "../app/card/BallotCard";

const CHECK = JSON.parse(fs.readFileSync("data/civic/ballot_order_check.json", "utf8")) as { zip: string; race_id: string; official_order: string[] | null; status: string }[];
const AUDIT = JSON.parse(fs.readFileSync("data/civic/bp22/ballotpedia_stance_audit.json", "utf8"));
const AUDIT_ROWS: { candidate: string; keep_final: boolean; final_reason: string }[] = Array.isArray(AUDIT) ? AUDIT : AUDIT.records ?? AUDIT.stances ?? [];
const ZIPS = ["78701", "94103", "10001"];
const TRAVIS = "https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf";
const NYC = "https://img1.wsimg.com/isteam/ip/eb67ae7b-312c-407d-a59a-c4b41353c238/71AD_SampleBallot_Nov2026.pdf";
const SF = "https://media.api.sf.gov/documents/N26_EN_VIP.pdf";
const NY_CONFIRMED = ["ny-governor", "ny-attorney-general", "ny-comptroller", "ny-supreme-1jd", "ny-surrogate-ny", "ny-civil-county-ny"];
const ids = ISSUES.map((i) => i.id);
const names = (r: { candidates?: { name: string }[] }) => (r.candidates ?? []).map((c) => c.name);
const official = (c: { official_order: string[] | null }) => (c.official_order ?? []).map(bareName);
const tileNames = (html: string) => [...html.matchAll(/title="([^"]+)" aria-label="[^"]+" data-tile-label/g)].map((m) => m[1].replace(/&amp;/g, "&").replace(/&#x27;/g, "'"));
const cardNames = (html: string) => [...html.matchAll(/data-overlap="([^"]+)"/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'"));

describe("ballot order: data and every renderer follow the official sample ballot", () => {
  const confirmed = CHECK.filter((c) => c.status === "MATCH" || c.status === "MISMATCH" ? orderLineFor(c.zip, ballotFor(c.zip)!.races.find((r) => r.id === c.race_id)!)?.confirmed : false);
  it("78701: all 58 races confirmed; 10001: the six NYC BOE contests; 94103: none", () => {
    const by = (z: string) => confirmed.filter((c) => c.zip === z).map((c) => c.race_id);
    expect(by("78701")).toHaveLength(58);
    expect(by("10001").sort()).toEqual([...NY_CONFIRMED].sort());
    expect(by("94103")).toEqual([]);
  });
  it("for each confirmed race, data order, the API order line, Towny's list, the race tiers and the card all equal official_order", async () => {
    for (const z of ZIPS) {
      const b = ballotFor(z)!;
      const api = withOrderLines(z, b)!;
      const tiers = (rid: string) => renderToStaticMarkup(h(RaceTiers, { races: [api.races.find((r) => r.id === rid)] as never, market: () => null as never }));
      for (const c of confirmed.filter((x) => x.zip === z)) {
        const r = b.races.find((x) => x.id === c.race_id)!;
        const want = official(c);
        expect(names(r), c.race_id).toEqual(want);
        const ar = api.races.find((x) => x.id === c.race_id)!;
        expect(names(ar), c.race_id).toEqual(want);
        expect(ar.order).toMatchObject({ text: ORDER_CONFIRMED_LINE, confirmed: true, url: z === "78701" ? TRAVIS : NYC });
        const t = tiers(c.race_id);
        // motion-v2 splits a ticket ("A / B") into two tiles in the same order, so compare the split names.
        if (t.includes("data-tile-label")) expect(tileNames(t), c.race_id).toEqual(want.flatMap((n) => n.split(" / ")));
        if (t.includes("data-order-line")) expect(t).toContain('data-order-line="confirmed"');
      }
      const card = renderToStaticMarkup(h(BallotCard, { zip: z, place: z, ids, races: api.races as never }));
      for (const c of confirmed.filter((x) => x.zip === z)) {
        const want = official(c);
        const seen = cardNames(card).filter((n) => want.includes(n));
        if (seen.length) expect(seen.slice(0, want.length), c.race_id).toEqual(want);
      }
    }
    // Explicit, non-vacuous checks on the Senate race in both renderers.
    const api78 = withOrderLines("78701", ballotFor("78701"))!;
    const sen = renderToStaticMarkup(h(RaceTiers, { races: [api78.races.find((r) => r.id === "us-senate-tx")] as never, market: () => null as never }));
    expect(tileNames(sen)).toEqual(["Ken Paxton", "James Talarico", "Ted Brown"]);
    expect(sen).toContain('data-order-line="confirmed"');
    const card78 = renderToStaticMarkup(h(BallotCard, { zip: "78701", place: "78701", ids, races: api78.races as never }));
    expect(cardNames(card78).filter((n) => ["Ken Paxton", "James Talarico", "Ted Brown"].includes(n))).toEqual(["Ken Paxton", "James Talarico", "Ted Brown"]);
    expect(card78).toContain('data-order-line="confirmed"');
    // Towny's race list keeps the same order.
    const r = await answerFollowup({ zip: "78701", question: "Who is running for Senate?", answers: {} }, { useModel: false, live: false });
    const at = (n: string) => r.reply.indexOf(n);
    expect(at("Ken Paxton")).toBeLessThan(at("James Talarico"));
    expect(at("James Talarico")).toBeLessThan(at("Ted Brown"));
  });
  it("order lines: 10001 unconfirmed and all 94103 contested races are unsure with their office source; single-candidate races get no line", () => {
    for (const z of ["10001", "94103"]) {
      const b = withOrderLines(z, ballotFor(z))!;
      for (const c of CHECK.filter((x) => x.zip === z)) {
        const r = b.races.find((x) => x.id === c.race_id);
        if (!r) continue;
        if (c.status === "MATCH_SINGLE") { expect(r.order ?? null, c.race_id).toBeNull(); continue; }
        if (NY_CONFIRMED.includes(c.race_id)) { expect(r.order).toMatchObject({ confirmed: true, label: "NYC Board of Elections sample ballot (New York County)", url: NYC }); continue; }
        expect(r.order, c.race_id).toMatchObject({ text: ORDER_UNSURE_LINE, confirmed: false });
        if (z === "94103") expect(r.order).toMatchObject({ label: "SF Department of Elections", url: SF });
      }
    }
    expect(CHECK.filter((c) => c.zip === "94103" && c.status === "MATCH_SINGLE")).toHaveLength(13);
  });
});

describe("stance audit: one rule for the site, Towny and getCandidatePositions", () => {
  it("Civic's audit: 75 kept, 16 stale", () => {
    expect(AUDIT_ROWS).toHaveLength(91);
    expect(AUDIT_ROWS.filter((r) => r.keep_final === true)).toHaveLength(75);
    const stale = AUDIT_ROWS.filter((r) => r.keep_final === false);
    expect(stale).toHaveLength(16);
    for (const r of stale) expect(r.final_reason).toMatch(/stale/i);
  });
  it("per candidate, counted stances match across stancesFor, Towny's positions and getCandidatePositions", () => {
    let n = 0;
    for (const z of ZIPS) for (const r of ballotFor(z)!.races) for (const c of r.candidates ?? []) {
      const st = stancesFor(c.name);
      const site = Object.values(st).filter((s) => s && s.value !== null && !s.unsureReason).length;
      const towny = positionsOf(c.name, (c as { campaignSite?: string | null }).campaignSite ?? null, null).filter((p) => !p.unsure).length;
      const g = getCandidatePositions(c.name) as { positions?: { counted: boolean }[] };
      const tool = (g.positions ?? []).filter((p) => p.counted).length;
      expect([towny, tool], `${z} ${r.id} ${c.name}`).toEqual([site, site]);
      n += site;
    }
    expect(n).toBeGreaterThan(400);
  });
  it("Bo French (education): Ballotpedia-quoted 2016 campaign text, unscored and unsure", () => {
    const s = stancesFor("Bo French").education;
    expect(s).toMatchObject({ value: null, sourceUrl: "https://ballotpedia.org/Bo_French#Campaign_themes", sourceTitle: "Campaign website (bofrench.com, 2016 Texas House race; quoted by Ballotpedia)" });
  });
});
