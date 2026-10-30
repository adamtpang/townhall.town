import { describe, it, expect } from "vitest";
import { labelMarketPrices } from "../lib/api/agent";

const results = {
  getRaces: { races: [{ id: "tx-cd37", title: "U.S. Representative, District 37" }], measures: [] },
  getMarketOdds: { "tx-cd37": { status: "live", quotes: [{ outcomes: [{ name: "Greg Casar", prob: 0.98 }, { name: "Other", prob: 0.02 }] }] } },
};

describe("agent trace QA (Oct 30 prod check P1-5)", () => {
  it("labels a bare market number as a Polymarket price", () => {
    expect(labelMarketPrices("- U.S. Representative, District 37 is not competitive, with Greg Casar at 98%.", results)).toBe(
      "- U.S. Representative, District 37 is not competitive, with Greg Casar at Polymarket price 98%.",
    );
  });
  it("leaves already-labelled prices and non-market lines alone", () => {
    expect(labelMarketPrices("- Greg Casar leads at Polymarket price 98%.", results)).toBe("- Greg Casar leads at Polymarket price 98%.");
    expect(labelMarketPrices("- Prop A adds 2% to the rate.", results)).toBe("- Prop A adds 2% to the rate.");
    expect(labelMarketPrices("- Greg Casar leads at a 98% Polymarket market price (what traders pay, not a poll).", results)).toBe(
      "- Greg Casar leads at a 98% Polymarket market price (what traders pay, not a poll).",
    );
  });
  it("never rewrites numbers that are not market prices", () => {
    expect(labelMarketPrices("- Greg Casar race: 51.7% statewide.", results)).toBe("- Greg Casar race: 51.7% statewide.");
  });
});

import { marketLine, acsYearLabel } from "../lib/api/agent";
import { readFileSync } from "node:fs";

describe("agent trace QA P2 (adb3628)", () => {
  it("market line lists every outcome as a market price (Civic summary23 replaces QA P2(a) wording)", () => {
    const l = marketLine([{ contest: "U.S. Representative, District 37", leader: "Greg Casar", polymarketPricePct: 98, competitive: false, outcomes: [{ name: "Greg Casar", pct: 98 }, { name: "Lauren Pe\u00f1a", pct: 2 }], url: "https://polymarket.com/event/tx-37-house-election-winner" }]);
    expect(l).toContain("Greg Casar 98%, Lauren Pe\u00f1a 2%");
    expect(l).toContain("market price, not a poll or forecast");
    expect(l).not.toMatch(/has a leader|lopsided/);
    expect(marketLine([])).toBe("");
  });
  it("ACS year label has no nested parentheses", () => {
    expect(acsYearLabel("ACS 2024 5-year (2020-2024)")).toBe("ACS 5-year estimates, 2020-2024");
    expect(acsYearLabel(undefined)).toBe("ACS 5-year estimates");
  });
  it("status lines never say 'deterministically' or 'Model skipped'", () => {
    const src = readFileSync("lib/api/agent.ts", "utf8");
    expect(src).not.toMatch(/message: [^\n]*deterministically/);
    expect(src).not.toMatch(/Model skipped/);
  });
});
